"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { type Concert } from "@/lib/concerts";
import { useShowcase, type ShowcaseBooking } from "@/lib/showcase-store";
import {
  checkBookingPayment,
  clearPending,
  connectFreighter,
  pendingPayment,
  prepareBookingPayment,
  shortAddress,
  signAndSubmitBookingPayment,
  type PaymentResult,
  type PaymentReview,
} from "@/lib/paid-booking-client";
import { formatStroops, usdcToStroops } from "@/lib/xlm-price";
import {
  ownSelection,
  releaseSelection,
  seatingFor,
  selectionDeadline,
  toggleSeat,
  useSeating,
} from "@/lib/seating-store";
import { seatLabel, type SeatTicket } from "@/lib/seating-data";
import { CinemaIcon } from "./cinema";
import { SectionSeats, useSeatingClock, VenueMap } from "./seating-map";
import { demoApi, useAuth } from "@/lib/auth-client";
import { refreshRecords } from "@/lib/customer-records";

const money = (n: number) => n.toFixed(2);
const UNSETTLED: PaymentResult["status"][] = ["submitted", "pending_verification"];
export function BookingSeatDetails({ items }: { items: SeatTicket[] }) {
  return (
    <div className="booking-seat-details">
      {items.map((item) => (
        <div
          key={item.id}
          style={{ "--zone-color": item.color } as CSSProperties}
        >
          <strong>{item.categoryName}</strong>
          <span>
            {seatLabel(item)}
            {item.accessible ? " · Accessible" : ""}
          </span>
          <span>{money(item.price)} USDC</span>
        </div>
      ))}
    </div>
  );
}

export default function SeatBooking({
  concert,
  onClose,
  resume = false,
}: {
  concert: Concert;
  onClose: () => void;
  onWallet: () => void;
  resume?: boolean;
}) {
  const { ready } = useAuth();
  const ref = useRef<HTMLDialogElement>(null);
  const showcase = useShowcase();
  const snapshot = useSeating();
  const now = useSeatingClock();
  const { event, venue } = seatingFor(snapshot, concert.id);
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [stage, setStage] = useState<
    "seats" | "checkout" | "processing" | "confirmed"
  >("seats");
  const [booking, setBooking] = useState<ShowcaseBooking | null>(null);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [expanded, setExpanded] = useState(false);
  // Live payment through Paiflow on Stellar testnet, signed in Freighter.
  const [freighter, setFreighter] = useState<string | null>(null);
  const [review, setReview] = useState<PaymentReview | null>(null);
  const [consent, setConsent] = useState(false);
  const [payment, setPayment] = useState<PaymentResult | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [pending, setPending] = useState(() => {
    const saved = typeof window === "undefined" ? null : pendingPayment();
    return saved?.eventId === concert.id ? saved.orderId : null;
  });
  const selected = ownSelection(snapshot, concert.id, showcase.inventory, now);
  const deadline = selectionDeadline(snapshot, concert.id);
  const remaining = deadline
    ? Math.min(300, Math.max(0, Math.ceil((deadline - now) / 1000)))
    : 0;
  const subtotal =
    Math.round(selected.reduce((sum, item) => sum + item.price, 0) * 100) / 100;
  const fee = Math.round(subtotal * 5) / 100;
  const total = Math.round((subtotal + fee) * 100) / 100;
  const totalXlm = formatStroops(usdcToStroops(total));
  // An unsettled payment from an earlier visit (not the one on screen) must be
  // checked before a new one is prepared, so its recovery record isn't lost.
  const previousPending = pending && pending !== review?.orderId ? pending : null;
  const section = venue.sections.find((s) => s.id === sectionId);
  const expired = !!deadline && now > 0 && deadline <= now;
  const groups = [...new Set(selected.map((s) => s.categoryId))].map((id) => ({
    id,
    name: selected.find((s) => s.categoryId === id)!.categoryName,
    color: selected.find((s) => s.categoryId === id)!.color,
    items: selected.filter((s) => s.categoryId === id),
  }));
  const mixedInvalid = !event.allowMixed && groups.length > 1;
  const resumed = useRef(false);
  useEffect(() => {
    if (!resume || !ready || !snapshot.session || resumed.current) return;
    resumed.current = true;
    const items = ownSelection(
      snapshot,
      concert.id,
      showcase.inventory,
      Date.now(),
    );
    void demoApi("holds", {
      eventId: concert.id,
      session: snapshot.session,
      seats: items.map((s) => s.id),
      expires: deadline,
    })
      .then(() => {
        if (items.length) setStage("checkout");
      })
      .catch(() => {
        setStage("seats");
        setError(
          "Your reservation expired or the selected tickets are no longer available. Select your tickets again.",
        );
      });
  }, [resume, ready, snapshot, concert.id, showcase.inventory, deadline]);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
    };
  }, []);
  function choose(id: string) {
    try {
      toggleSeat(concert.id, id, showcase.inventory);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to select this seat.");
    }
  }
  const message = (e: unknown, fallback: string) =>
    e instanceof Error ? e.message : fallback;
  async function connectWallet() {
    setError("");
    try {
      setFreighter(await connectFreighter());
      setReview(null);
      setConsent(false);
    } catch (e) {
      setError(message(e, "Unable to connect Freighter."));
    }
  }
  // Step 1: the server prices the seats and prepares the Paiflow payment.
  async function reviewPayment() {
    if (!freighter) {
      setError("Connect Freighter to continue.");
      return;
    }
    if (!selected.length || expired) {
      setStage("seats");
      setError("Your reservation expired. Select your tickets again.");
      return;
    }
    setStage("processing");
    setProgress(0);
    setError("");
    try {
      const prepared = await prepareBookingPayment({
        eventId: concert.id,
        seats: selected.map((s) => s.id),
        total,
        holdSession: snapshot.session,
        holdExpiresAt: deadline,
        walletAddress: freighter,
      });
      setReview(prepared);
      setPending(prepared.orderId);
      setConsent(false);
    } catch (e) {
      setError(message(e, "Unable to prepare this payment."));
    }
    setStage("checkout");
  }
  // Leaving before any signing attempt drops the unsigned preparation, so it
  // doesn't block the next payment. After an attempt it must be checked instead.
  function discardUnsigned() {
    if (!review || attempted) return;
    clearPending();
    setPending(null);
    setReview(null);
  }
  function close() {
    discardUnsigned();
    onClose();
  }
  // Step 2: after explicit consent, Freighter signs and the server submits.
  async function pay() {
    if (!review || !freighter || !consent) return;
    setAttempted(true);
    setStage("processing");
    setProgress(1);
    setError("");
    let result: PaymentResult;
    try {
      result = await signAndSubmitBookingPayment(review, freighter);
    } catch (e) {
      setError(message(e, "Unable to complete this payment."));
      setStage("checkout");
      return;
    }
    // A just-submitted payment normally confirms within seconds; keep checking
    // the same transaction for about a minute before handing over to the
    // manual Check payment button.
    setProgress(2);
    for (let i = 0; i < 15 && UNSETTLED.includes(result.status); i++) {
      await new Promise((r) => setTimeout(r, 4000));
      try {
        result = await checkBookingPayment(result.orderId);
      } catch {
        break;
      }
    }
    showResult(result, "checkout");
  }
  // Recovery: re-verify the original transaction; never pays again.
  async function checkPayment(orderId: string) {
    const back = stage === "seats" ? "seats" : "checkout";
    setStage("processing");
    setProgress(2);
    setError("");
    try {
      showResult(await checkBookingPayment(orderId), back);
    } catch (e) {
      setError(message(e, "Unable to check this payment."));
      setStage(back);
    }
  }
  function showResult(result: PaymentResult, back: "seats" | "checkout") {
    setPayment(result);
    if (result.status === "paid" && result.booking) {
      setBooking(result.booking);
      setPending(null);
      setReview(null);
      releaseSelection(concert.id);
      void refreshRecords();
      setStage("confirmed");
      return;
    }
    const settled = {
      failed: `The payment failed${result.detail ? `: ${result.detail}` : ""}. No booking was created.`,
      payout_mismatch: `Your payment went through (transaction ${result.txHash?.slice(0, 12)}…), but the payouts didn't match FairTix's 90/10 split, so no ticket was issued. Contact the organizer with this transaction for a refund. Don't pay again for these seats.`,
      expired: "Your previous payment was never sent and has expired. No funds moved. You can pay now.",
      not_found: "Your previous payment record is no longer available. Check your Freighter history before paying again.",
    }[result.status as string];
    if (settled) {
      setPending(null);
      setReview(null);
      setPayment(null);
      setAttempted(false);
      setError(settled);
    } else if (result.detail && !result.txHash) {
      setError(result.detail);
    }
    setStage(back);
  }
  return (
    <dialog
      ref={ref}
      className="seat-dialog venue-booking-dialog"
      aria-label="Choose concert seats and checkout"
      onCancel={(e) => {
        if (stage === "processing") e.preventDefault();
        else close();
      }}
    >
      <div className="seat-dialog-heading">
        <div>
          <h2>
            {stage === "seats"
              ? "Select Seats"
              : stage === "confirmed"
                ? "Booking Confirmed"
                : "Checkout"}
          </h2>
          <p>
            {concert.artist} {concert.title} · {venue.name}
          </p>
        </div>
        <button
          type="button"
          className="cinema-icon-button"
          aria-label="Close seat selection"
          onClick={close}
          disabled={stage === "processing"}
        >
          <CinemaIcon name="close" />
        </button>
      </div>
      <ol className="booking-stepper" aria-label="Booking progress">
        {["Choose Seats", "Payment", "Confirmation"].map((label, index) => {
          const current = stage === "seats" ? 0 : stage === "confirmed" ? 2 : 1;
          return (
            <li
              key={label}
              className={
                index < current
                  ? "complete"
                  : index === current
                    ? "current"
                    : ""
              }
              aria-current={index === current ? "step" : undefined}
            >
              <span>
                {index < current ? (
                  <CinemaIcon name="check" size={16} />
                ) : (
                  index + 1
                )}
              </span>
              <strong>{label}</strong>
            </li>
          );
        })}
      </ol>
      {previousPending && stage !== "processing" && stage !== "confirmed" && (
        <div className="seat-error" role="status">
          You have an earlier payment for this event that isn&apos;t settled
          yet. Check it before paying again.{" "}
          <button
            type="button"
            className="button secondary compact"
            onClick={() => checkPayment(previousPending)}
          >
            Check payment
          </button>
        </div>
      )}
      {(error ||
        mixedInvalid ||
        (expired && stage !== "confirmed" && !review)) && (
        <p className="seat-error" role="alert">
          {error ||
            (mixedInvalid
              ? "This event now allows one category per booking. Remove tickets from other categories."
              : "Your reservation expired. Select your tickets again.")}
        </p>
      )}
      {stage === "confirmed" && booking ? (
        <div className="booking-complete">
          <span className="booking-check">
            <CinemaIcon name="check" size={35} />
          </span>
          <h3>Your booking is confirmed.</h3>
          <p>
            {booking.txHash
              ? "Paid on Stellar Testnet through Paiflow and payout-verified. Your receipt and QR pass are saved to My Tickets."
              : "No funds were sent. Your receipt and QR pass are saved to My Tickets."}
          </p>
          <BookingSeatDetails items={booking.lineItems || []} />
          <div className="receipt">
            <div>
              <span>Booking</span>
              <strong>{booking.id}</strong>
            </div>
            <div>
              <span>Quantity</span>
              <strong>{booking.seats.length}</strong>
            </div>
            <div>
              <span>Total</span>
              <strong>
                {money(booking.total)} USDC
                {booking.paidXlm ? ` · paid ${booking.paidXlm} XLM` : ""}
              </strong>
            </div>
            <div>
              <span>Transaction hash</span>
              {booking.txHash ? (
                <a
                  href={`https://stellar.expert/explorer/testnet/tx/${booking.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <strong>{booking.txHash.slice(0, 12)}… on Stellar Expert</strong>
                </a>
              ) : (
                <strong>None · Simulated payment</strong>
              )}
            </div>
          </div>
          <Link href="/tickets" className="button primary" onClick={onClose}>
            My Tickets <CinemaIcon name="ticket" size={17} />
          </Link>
        </div>
      ) : (
        <div className="seat-dialog-body">
          <div className="seat-main">
            {stage === "seats" ? (
              <>
                <div className="venue-selection-note">
                  <span>Ticket Categories</span>
                  <span>
                    {event.allowMixed
                      ? "Multiple categories allowed"
                      : "One category per booking"}{" "}
                    · Up to 6 tickets
                  </span>
                </div>
                {section ? (
                  <>
                    <button
                      type="button"
                      className="button secondary compact back-to-venue"
                      onClick={() => {
                        setSectionId(null);
                        setError("");
                      }}
                    >
                      ← Back to Venue Map
                    </button>
                    <SectionSeats
                      snapshot={snapshot}
                      eventId={concert.id}
                      section={section}
                      bookings={showcase.inventory}
                      now={now}
                      onSeat={(seat) => choose(seat.id)}
                    />
                    <div
                      className="section-switcher"
                      aria-label="Switch section"
                    >
                      {venue.sections.map((s) => (
                        <button
                          type="button"
                          key={s.id}
                          aria-pressed={s.id === section.id}
                          onClick={() => setSectionId(s.id)}
                          style={
                            {
                              "--zone-color": venue.categories.find(
                                (c) => c.id === s.categoryId,
                              )!.color,
                            } as CSSProperties
                          }
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <VenueMap
                    snapshot={snapshot}
                    eventId={concert.id}
                    bookings={showcase.inventory}
                    now={now}
                    selectedSection={sectionId}
                    onSection={setSectionId}
                  />
                )}
              </>
            ) : (
              <div className="checkout-preview">
                <span className="cinema-kicker">Stellar Testnet / XLM via Paiflow</span>
                <h3>
                  {stage === "processing"
                    ? "Processing your payment…"
                    : "Payment Details"}
                </h3>
                <div className="payment-wallet">
                  <CinemaIcon name="user" size={23} />
                  <div>
                    <strong>
                      {freighter ? "Freighter wallet" : "Wallet not connected"}
                    </strong>
                    <span>
                      {freighter
                        ? `${shortAddress(freighter)} · Testnet`
                        : "Connect Freighter on Stellar Testnet to pay."}
                    </span>
                  </div>
                  {stage !== "processing" && !review && (
                    <button
                      type="button"
                      className="button secondary compact"
                      onClick={connectWallet}
                    >
                      {freighter ? "Reconnect" : "Connect Freighter"}
                    </button>
                  )}
                </div>
                {review ? (
                  <>
                  <div className="receipt">
                    <div>
                      <span>Network</span>
                      <strong>TESTNET</strong>
                    </div>
                    <div>
                      <span>You pay</span>
                      <strong>{review.review.amountXlm} XLM</strong>
                    </div>
                    {review.review.recipients.map((r) => (
                      <div key={r.address}>
                        <span>{r.label}</span>
                        <strong>
                          {r.amountXlm} XLM → {shortAddress(r.address)}
                        </strong>
                      </div>
                    ))}
                    <div>
                      <span>Max network fee</span>
                      <strong>{review.review.maxFeeXlm} XLM (extra)</strong>
                    </div>
                  </div>
                  <label
                    style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", margin: "4px 0 16px" }}
                  >
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                      style={{ width: 18, height: 18, minHeight: 0, padding: 0, flex: "none", margin: "1px 0 0" }}
                    />
                    I approve paying {review.review.amountXlm} XLM plus the
                    network fee on Stellar Testnet.
                  </label>
                  </>
                ) : (
                  <p className="seat-summary-note">
                    {money(total)} USDC is charged as about {totalXlm} XLM at
                    the demo rate (1 XLM = 0.17 USD). Paiflow splits it 90% to
                    the shop and 10% to the community fund.
                  </p>
                )}
                {payment && UNSETTLED.includes(payment.status) && payment.txHash && (
                  <div className="seat-error" role="status">
                    {payment.warning ||
                      "Your payment is still confirming. Check it again in a moment; don't pay twice."}{" "}
                    <a
                      href={`https://stellar.expert/explorer/testnet/tx/${payment.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View transaction
                    </a>{" "}
                    <button
                      type="button"
                      className="button secondary compact"
                      disabled={stage === "processing"}
                      onClick={() => checkPayment(payment.orderId)}
                    >
                      Check payment
                    </button>
                  </div>
                )}
                <div className="payment-status-list">
                  {[
                    "Prepare Payment",
                    "Sign & Submit",
                    "Verify Payouts",
                  ].map((label, i) => (
                    <div
                      key={label}
                      className={
                        stage === "processing" && i <= progress ? "current" : ""
                      }
                    >
                      <span>
                        {stage === "processing" && i < progress ? (
                          <CinemaIcon name="check" size={14} />
                        ) : (
                          `0${i + 1}`
                        )}
                      </span>
                      {label}
                      <small>
                        {stage === "processing" && i === progress
                          ? "Processing…"
                          : "Pending"}
                      </small>
                    </div>
                  ))}
                </div>
                <div className="demo-payment-warning">
                  Testnet only: this sends real Stellar Testnet XLM, which has
                  no monetary value. Your booking is issued only after the
                  payment and both payouts are verified.
                </div>
              </div>
            )}
          </div>
          <aside
            className={`seat-summary venue-order-summary ${expanded ? "summary-expanded" : ""}`}
          >
            <div className="venue-summary-header">
              <h3>Order Summary</h3>
              <span>
                {selected.length} {selected.length === 1 ? "ticket" : "tickets"}
              </span>
            </div>
            <p className="summary-concert-name">
              {concert.artist} {concert.title}
            </p>
            <p className="summary-venue-name">
              {venue.name} · {concert.city}
            </p>
            <button
              type="button"
              className="mobile-summary-toggle"
              aria-expanded={expanded}
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? "Hide details" : "Order details"}{" "}
              {expanded ? "−" : "+"}
            </button>
            <div className="venue-summary-details">
              {groups.length ? (
                groups.map((group) => (
                  <div
                    className="summary-category-group"
                    key={group.id}
                    style={{ "--zone-color": group.color } as CSSProperties}
                  >
                    <div>
                      <strong>{group.name}</strong>
                      <span>
                        {group.items.length} × {money(group.items[0].price)}{" "}
                        USDC
                      </span>
                    </div>
                    {group.items.map((item) => (
                      <div className="summary-seat-line" key={item.id}>
                        <span>
                          {seatLabel(item)}
                          {item.accessible ? " · ♿" : ""}
                        </span>
                        <button
                          type="button"
                          aria-label={`Remove ${seatLabel(item)}`}
                          disabled={stage === "processing"}
                          onClick={() => choose(item.id)}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                ))
              ) : (
                <p className="empty-selection">
                  <CinemaIcon name="ticket" size={26} />
                  No tickets selected yet.
                </p>
              )}
              {selected.length > 0 && stage === "seats" && (
                <button
                  type="button"
                  className="clear-selection"
                  onClick={() => {
                    releaseSelection(concert.id);
                    setError("");
                  }}
                >
                  Clear selection
                </button>
              )}
              <div className="receipt">
                <div>
                  <span>Subtotal</span>
                  <strong>{money(subtotal)} USDC</strong>
                </div>
                <div>
                  <span>Service fee (5%)</span>
                  <strong>{money(fee)} USDC</strong>
                </div>
              </div>
            </div>
            <div className="venue-summary-footer">
              <div className="venue-total">
                <span>Total</span>
                <strong>
                  {money(total)} <small>USDC</small>
                </strong>
              </div>
              {deadline && !expired && selected.length > 0 && (
                <div
                  className="hold-countdown"
                  role="timer"
                  aria-label="Reservation time remaining"
                >
                  <span>Reservation</span>
                  <strong>
                    {Math.floor(remaining / 60)}:
                    {String(remaining % 60).padStart(2, "0")}
                  </strong>
                </div>
              )}
              {stage === "seats" ? (
                <button
                  type="button"
                  className="button primary full"
                  disabled={!selected.length || expired || mixedInvalid}
                  onClick={async () => {
                    try {
                      await demoApi("holds", {
                        eventId: concert.id,
                        session: snapshot.session,
                        seats: selected.map((s) => s.id),
                        expires: deadline,
                      });
                    } catch (e) {
                      setError((e as Error).message);
                      void refreshRecords();
                      return;
                    }
                    void refreshRecords();
                    setStage("checkout");
                    setError("");
                  }}
                >
                  Continue to Checkout <CinemaIcon name="arrow" size={16} />
                </button>
              ) : (
                <>
                  {review ? (
                    <button
                      type="button"
                      className="button primary full"
                      disabled={!consent || stage === "processing" || !!payment}
                      onClick={pay}
                    >
                      {stage === "processing"
                        ? "Processing…"
                        : `Sign in Freighter & Pay ${review.review.amountXlm} XLM`}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="button primary full"
                      disabled={
                        !freighter ||
                        !!previousPending ||
                        stage === "processing" ||
                        !selected.length ||
                        expired ||
                        mixedInvalid
                      }
                      onClick={reviewPayment}
                    >
                      {stage === "processing"
                        ? "Processing…"
                        : `Review Payment · ≈${totalXlm} XLM`}
                    </button>
                  )}
                  <button
                    type="button"
                    className="button quiet full"
                    disabled={stage === "processing" || !!payment}
                    onClick={() => {
                      discardUnsigned();
                      setStage("seats");
                    }}
                  >
                    Back to seats
                  </button>
                </>
              )}
              <span className="seat-summary-note">
                Reservation expires after 5 minutes
              </span>
            </div>
          </aside>
        </div>
      )}
    </dialog>
  );
}
