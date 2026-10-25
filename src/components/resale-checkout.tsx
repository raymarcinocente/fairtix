"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { concerts } from "@/lib/concerts";
import type { ResaleListing } from "@/lib/resale-types";
import type { ShowcaseBooking } from "@/lib/showcase-store";
import { useDemo, wallets } from "@/lib/demo-store";
import { demoApi } from "@/lib/auth-client";
import { refreshRecords } from "@/lib/customer-records";
import { seatingFor, useSeating } from "@/lib/seating-store";
import { sectionSeats, seatLabel } from "@/lib/seating-data";
import { VenueMap, useSeatingClock } from "./seating-map";
import { CinemaIcon } from "./cinema";
import { BookingSeatDetails } from "./seat-booking";
import CurrencyConverter from "./currency-converter";
import WalletBalances from "./wallet-balances";

export default function ResaleCheckout({
  listing,
  onClose,
  onWallet,
}: {
  listing: ResaleListing;
  onClose: () => void;
  onWallet: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    hold = useRef<Promise<unknown> | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [stage, setStage] = useState<
    "details" | "payment" | "processing" | "confirmed"
  >("details");
  const [expires, setExpires] = useState(0),
    [error, setError] = useState(""),
    [closing, setClosing] = useState(false),
    [receipt, setReceipt] = useState<ShowcaseBooking | null>(null);
  const data = useDemo(),
    snapshot = useSeating(),
    now = useSeatingClock();
  const wallet = wallets.find((w) => w.id === data.wallet);
  const concert = concerts.find((c) => c.id === listing.eventId)!;
  const { venue } = seatingFor(snapshot, listing.eventId);
  const section = venue.sections.find((s) => s.id === listing.ticket.sectionId);
  const fee = Math.round(listing.price * 5) / 100,
    total = Math.round((listing.price + fee) * 100) / 100;
  const expired = expires > 0 && now >= expires;
  const remaining = Math.max(0, Math.ceil((expires - now) / 1000));
  const current = stage === "details" ? 0 : stage === "confirmed" ? 2 : 1;
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    let active = true;
    hold.current = demoApi<{ expires: number }>("resale/hold", {
      id: listing.id,
    })
      .then((result) => {
        if (active) setExpires(result.expires);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
      dialog?.close();
    };
  }, [listing.id]);
  async function close() {
    if (stage === "processing" || closing) return;
    setClosing(true);
    await hold.current;
    if (stage !== "confirmed")
      await demoApi("resale/release", { id: listing.id }).catch(() => {});
    onClose();
    void refreshRecords();
  }
  async function buy() {
    if (!wallet || expired || !expires || stage === "processing") return;
    setStage("processing");
    setError("");
    try {
      const result = await demoApi<{ booking: ShowcaseBooking }>("resale/buy", {
        id: listing.id,
        total,
        paymentMode: "demo",
      });
      setReceipt(result.booking);
      setStage("confirmed");
      await refreshRecords();
    } catch (e) {
      setError((e as Error).message);
      setStage("payment");
      void refreshRecords();
    }
  }
  return (
    <dialog
      ref={ref}
      className="seat-dialog venue-booking-dialog resale-checkout-dialog"
      aria-label="Buy resale ticket"
      onCancel={(e) => {
        e.preventDefault();
        void close();
      }}
    >
      <div className="seat-dialog-heading">
        <div>
          <h2>
            {stage === "confirmed"
              ? "Purchase Confirmed"
              : stage === "details"
                ? "Resale Ticket"
                : "Checkout"}
          </h2>
          <p>
            {concert.artist} {concert.title} · {venue.name}
          </p>
        </div>
        <button
          type="button"
          className="cinema-icon-button"
          aria-label="Close resale ticket"
          disabled={stage === "processing" || closing}
          onClick={() => void close()}
        >
          <CinemaIcon name="close" />
        </button>
      </div>
      <ol className="booking-stepper" aria-label="Resale purchase progress">
        {["Ticket Details", "Payment", "Confirmation"].map((name, index) => (
          <li
            key={name}
            className={
              index < current ? "complete" : index === current ? "current" : ""
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
            <strong>{name}</strong>
          </li>
        ))}
      </ol>
      {(error || (expired && stage !== "confirmed")) && (
        <p role="alert" className="seat-error">
          {error ||
            "Your reservation expired. Close this ticket and try again."}
        </p>
      )}
      {stage === "confirmed" && receipt ? (
        <div className="booking-complete">
          <span className="booking-check">
            <CinemaIcon name="check" size={35} />
          </span>
          <h3>Your resale ticket is ready.</h3>
          <p>
            The ticket is now in My Tickets. Payment was simulated; no funds
            were transferred.
          </p>
          <BookingSeatDetails items={receipt.lineItems || []} />
          <div className="receipt">
            <div>
              <span>Booking</span>
              <strong className="mono">{receipt.id}</strong>
            </div>
            <div>
              <span>Total</span>
              <strong>{receipt.total.toFixed(2)} USDC</strong>
            </div>
          </div>
          <Link href="/tickets" className="button primary" onClick={onClose}>
            View Ticket <CinemaIcon name="ticket" size={17} />
          </Link>
        </div>
      ) : (
        <div className="seat-dialog-body">
          <div className="seat-main">
            {stage === "details" ? (
              <>
                <div className="resale-ticket-facts">
                  <p>
                    <CinemaIcon name="calendar" size={18} />
                    {concert.date}
                  </p>
                  <p>
                    <CinemaIcon name="pin" size={18} />
                    {venue.name} · {concert.city}
                  </p>
                </div>
                <p className="resale-fixed-note">
                  {listing.ticket.row
                    ? "This ticket already has a seat assigned. You are buying the ticket shown below."
                    : "This ticket includes access to the highlighted general admission area. No seat selection is required."}
                </p>
                <VenueMap
                  snapshot={snapshot}
                  eventId={listing.eventId}
                  bookings={data.inventory}
                  now={now}
                  selectedSection={listing.ticket.sectionId}
                  onSection={() => {}}
                  readOnly
                />
                {section && (
                  <section
                    className="resale-seat-location"
                    style={
                      { "--zone-color": listing.ticket.color } as CSSProperties
                    }
                    aria-label="Fixed ticket location"
                  >
                    <h3>{listing.ticket.sectionName}</h3>
                    {listing.ticket.row ? (
                      <>
                        <p>
                          Row {listing.ticket.row} · Seat{" "}
                          {listing.ticket.number}
                        </p>
                        <div
                          className="resale-seat-rows"
                          role="img"
                          aria-label={`Ticket location: ${seatLabel(listing.ticket)}`}
                        >
                          <span className="resale-stage-direction">
                            ↑ Stage
                          </span>
                          {[
                            ...new Set(sectionSeats(section).map((s) => s.row)),
                          ].map((row) => (
                            <div className="resale-seat-row" key={row || "GA"}>
                              <span>{row}</span>
                              <div>
                                {sectionSeats(section)
                                  .filter((s) => s.row === row)
                                  .map((seat) => (
                                    <span
                                      key={seat.id}
                                      className={`resale-static-seat ${seat.id === listing.ticket.id ? "ticket-seat" : ""}`}
                                      aria-label={
                                        seat.id === listing.ticket.id
                                          ? "This ticket"
                                          : undefined
                                      }
                                    >
                                      {seat.number}
                                      {seat.id === listing.ticket.id && (
                                        <i>✓</i>
                                      )}
                                    </span>
                                  ))}
                              </div>
                            </div>
                          ))}
                        </div>
                        <p className="resale-location-key">
                          <i />
                          Highlighted seat is included with this ticket.
                        </p>
                      </>
                    ) : (
                      <p>
                        General admission · 1 ticket. This area has no assigned
                        rows or seats.
                      </p>
                    )}
                  </section>
                )}
              </>
            ) : (
              <div className="checkout-preview">
                <h3>
                  {stage === "processing"
                    ? "Processing your purchase…"
                    : "Payment Details"}
                </h3>
                <BookingSeatDetails
                  items={[{ ...listing.ticket, price: listing.price }]}
                />
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
                  {stage !== "processing" && (
                    <button
                      type="button"
                      className="button secondary compact"
                      onClick={onWallet}
                    >
                      {wallet ? "Use Another Wallet" : "Connect"}
                    </button>
                  )}
                </div>
                {stage !== "processing" && <><WalletBalances /><CurrencyConverter total={total} /></>}
                <p className="demo-payment-warning">
                  Payment is simulated. No funds are transferred and no
                  blockchain transaction is created.
                </p>
              </div>
            )}
          </div>
          <aside
            className={`seat-summary venue-order-summary ${expanded ? "summary-expanded" : ""}`}
          >
            <div className="venue-summary-header">
              <h3>Order Summary</h3>
              <span>1 ticket</span>
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
              <div className="resale-fixed-summary">
                <strong>{listing.ticket.categoryName}</strong>
                <p>{seatLabel(listing.ticket)}</p>
                <p>Quantity: 1 · Fixed ticket</p>
              </div>
              <div className="receipt">
                <div>
                  <span>Ticket price</span>
                  <strong>{listing.price.toFixed(2)} USDC</strong>
                </div>
                <div>
                  <span>Service fee (5%)</span>
                  <strong>{fee.toFixed(2)} USDC</strong>
                </div>
              </div>
            </div>
            <div className="venue-summary-footer">
              <div className="venue-total">
                <span>Total</span>
                <strong>
                  {total.toFixed(2)} <small>USDC</small>
                </strong>
              </div>
              {expires > 0 && !expired && (
                <div
                  className="hold-countdown"
                  role="timer"
                  aria-label="Resale reservation time remaining"
                >
                  <span>Reservation</span>
                  <strong>
                    {Math.floor(remaining / 60)}:
                    {String(remaining % 60).padStart(2, "0")}
                  </strong>
                </div>
              )}
              <button
                type="button"
                className="button primary full"
                disabled={
                  !expires ||
                  expired ||
                  !!error ||
                  stage === "processing" ||
                  (stage === "payment" && !wallet)
                }
                onClick={() =>
                  stage === "details" ? setStage("payment") : void buy()
                }
              >
                {!expires && !error
                  ? "Reserving ticket…"
                  : stage === "details"
                    ? "Continue to Checkout"
                    : stage === "processing"
                      ? "Processing…"
                      : "Buy Ticket"}
                <CinemaIcon name="arrow" size={16} />
              </button>
              {stage === "payment" && (
                <button
                  className="button quiet full"
                  onClick={() => setStage("details")}
                >
                  Back to Ticket
                </button>
              )}
            </div>
          </aside>
        </div>
      )}
    </dialog>
  );
}
