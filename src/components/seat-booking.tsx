"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { type Concert } from "@/lib/concerts";
import { useDemo, wallets } from "@/lib/demo-store";
import {
  createShowcaseBooking,
  useShowcase,
  type ShowcaseBooking,
} from "@/lib/showcase-store";
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
  onWallet,
  resume = false,
}: {
  concert: Concert;
  onClose: () => void;
  onWallet: () => void;
  resume?: boolean;
}) {
  const { ready } = useAuth();
  const ref = useRef<HTMLDialogElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const state = useDemo();
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
  const selected = ownSelection(snapshot, concert.id, showcase.inventory, now);
  const deadline = selectionDeadline(snapshot, concert.id);
  const remaining = deadline
    ? Math.min(300, Math.max(0, Math.ceil((deadline - now) / 1000)))
    : 0;
  const subtotal =
    Math.round(selected.reduce((sum, item) => sum + item.price, 0) * 100) / 100;
  const fee = Math.round(subtotal * 5) / 100;
  const total = Math.round((subtotal + fee) * 100) / 100;
  const wallet = wallets.find((w) => w.id === state.wallet);
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
      if (timer.current) clearTimeout(timer.current);
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
  function pay() {
    if (!wallet) {
      setError("Connect a wallet to continue.");
      return;
    }
    if (!selected.length || expired) {
      setStage("seats");
      setError("Your reservation expired. Select your tickets again.");
      return;
    }
    const order = [...selected];
    const session = snapshot.session;
    setStage("processing");
    setProgress(0);
    setError("");
    timer.current = setTimeout(() => {
      setProgress(1);
      timer.current = setTimeout(async () => {
        try {
          const result = await createShowcaseBooking({
            eventId: concert.id,
            wallet: wallet.id,
            category: groups.map((g) => g.name).join(", "),
            seats: order.map((s) => s.id),
            lineItems: order,
            holdSession: session,
            subtotal,
            fee,
            total,
          });
          setBooking(result);
          setStage("confirmed");
        } catch (e) {
          setError(
            e instanceof Error ? e.message : "Unable to create booking.",
          );
          setStage("seats");
        }
      }, 650);
    }, 650);
  }
  return (
    <dialog
      ref={ref}
      className="seat-dialog venue-booking-dialog"
      aria-label="Choose concert seats and checkout"
      onCancel={(e) => {
        if (stage === "processing") e.preventDefault();
        else onClose();
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
          onClick={onClose}
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
      {(error || mixedInvalid || (expired && stage !== "confirmed")) && (
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
            No funds were sent. Your receipt and QR pass are saved to My
            Tickets.
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
              <strong>{money(booking.total)} USDC</strong>
            </div>
            <div>
              <span>Transaction hash</span>
              <strong>None · Simulated payment</strong>
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
                <span className="cinema-kicker">Stellar / USDC</span>
                <h3>
                  {stage === "processing"
                    ? "Processing your booking…"
                    : "Payment Details"}
                </h3>
                <div className="payment-wallet">
                  <CinemaIcon name="user" size={23} />
                  <div>
                    <strong>
                      {wallet
                        ? `${wallet.name}’s sample wallet`
                        : "Wallet not connected"}
                    </strong>
                    <span>
                      {wallet?.address || "Connect a wallet to continue."}
                    </span>
                  </div>
                  {!wallet && (
                    <button
                      type="button"
                      className="button secondary compact"
                      onClick={onWallet}
                    >
                      Connect
                    </button>
                  )}
                </div>
                <div className="payment-status-list">
                  {[
                    "Wallet Connection",
                    "Payment Review",
                    "Booking Confirmation",
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
                  No USDC balance is deducted. No transaction hash is generated.
                  This is not a confirmed Stellar payment.
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
                  <button
                    type="button"
                    className="button primary full"
                    disabled={
                      !wallet ||
                      stage === "processing" ||
                      !selected.length ||
                      expired ||
                      mixedInvalid
                    }
                    onClick={pay}
                  >
                    {stage === "processing"
                      ? "Processing…"
                      : `Complete Booking · ${money(total)} USDC`}
                  </button>
                  <button
                    type="button"
                    className="button quiet full"
                    disabled={stage === "processing"}
                    onClick={() => setStage("seats")}
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
