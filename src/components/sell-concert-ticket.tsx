"use client";
import { useEffect, useRef, useState } from "react";
import type { ShowcaseBooking } from "@/lib/showcase-store";
import { demoApi } from "@/lib/auth-client";
import { refreshRecords, useRecords } from "@/lib/customer-records";
import { seatLabel } from "@/lib/seating-data";

export default function SellConcertTicket({ booking }: { booking: ShowcaseBooking }) {
  const data = useRecords();
  const listing = data.ownResale.find((listing) => listing.bookingId === booking.id);
  const [open, setOpen] = useState(false);
  const [seatId, setSeatId] = useState(booking.lineItems?.[0]?.id || "");
  const ticket = booking.lineItems?.find((ticket) => ticket.id === seatId);
  const [price, setPrice] = useState(String(ticket?.price || ""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (open) dialog?.showModal();
    return () => dialog?.close();
  }, [open]);
  if (!booking.lineItems?.length || booking.entryStatus) return null;
  async function cancel() {
    setBusy(true);
    setError("");
    try {
      await demoApi("resale/cancel", { id: listing!.id });
      await refreshRecords();
    } catch (e) {
      setError((e as Error).message);
    } finally { setBusy(false); }
  }
  return (
    <div className="concert-ticket-resale">
      {listing ? <>
        <p>Listed for {listing.price.toFixed(2)} USDC</p>
        <button className="button secondary compact" disabled={busy} onClick={() => void cancel()}>
          {busy ? "Cancelling…" : "Cancel Listing"}
        </button>
      </> : <button className="button secondary compact" onClick={() => { setError(""); setOpen(true); }}>Sell Ticket</button>}
      {error && !open && <p role="alert">{error}</p>}
      {open && <dialog ref={ref} className="modal" aria-label="Sell concert ticket" onCancel={() => setOpen(false)}>
        <div className="modal-heading">
          <h2>Sell Ticket</h2>
          <button className="cinema-icon-button" aria-label="Close sell ticket" onClick={() => setOpen(false)}>×</button>
        </div>
        <form onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true); setError("");
          try {
            await demoApi("resale/list", { bookingId: booking.id, seatId, price: Number(price) });
            await refreshRecords(); setOpen(false);
          } catch (e) { setError((e as Error).message); }
          finally { setBusy(false); }
        }}>
          <label htmlFor={`sell-seat-${booking.id}`}>Ticket</label>
          <select id={`sell-seat-${booking.id}`} value={seatId} onChange={(event) => {
            setSeatId(event.target.value);
            setPrice(String(booking.lineItems!.find((ticket) => ticket.id === event.target.value)!.price));
          }}>
            {booking.lineItems.map((ticket) => <option key={ticket.id} value={ticket.id}>{seatLabel(ticket)}</option>)}
          </select>
          <label htmlFor={`sell-price-${booking.id}`}>Resale price (USDC)</label>
          <input id={`sell-price-${booking.id}`} type="number" required min="0.01" max={ticket ? (Math.round(ticket.price * 110) / 100).toFixed(2) : undefined} step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} />
          <p>Maximum price: {ticket ? (Math.round(ticket.price * 110) / 100).toFixed(2) : "—"} USDC. Payments are simulated.</p>
          {error && <p role="alert">{error}</p>}
          <button className="button primary full" type="submit" disabled={busy}>{busy ? "Listing…" : "List Ticket"}</button>
        </form>
      </dialog>}
    </div>
  );
}
