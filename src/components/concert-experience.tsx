"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { demoApi, useAuth } from "@/lib/auth-client";
import QRCode from "react-qr-code";
import { concerts, type Concert } from "@/lib/concerts";
import { useDemo, wallets } from "@/lib/demo-store";
import {
  toggleSaved,
  useShowcase,
  type ShowcaseBooking,
} from "@/lib/showcase-store";
import { CinemaIcon, PosterShelf } from "./cinema";
import SeatBooking, { BookingSeatDetails } from "./seat-booking";
import SeatingManager from "./seating-manager";
import { seatingFor, useSeating } from "@/lib/seating-store";
import { configuredPrices } from "@/lib/seating-data";

const money = (n: number) => n.toFixed(2);
export function ConcertDetail({
  concert,
  onWallet,
}: {
  concert: Concert;
  onWallet: () => void;
}) {
  const [booking, setBooking] = useState(false);
  const router = useRouter();
  const resume = useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(window.location.search).get("checkout") === "1",
    () => false,
  );
  const saved = useShowcase().saved.includes(concert.id);
  const seating = useSeating();
  const { event, venue } = seatingFor(seating, concert.id);
  const prices = configuredPrices(event, venue);
  return (
    <div className="concert-detail">
      <div className="detail-banner">
        <Image
          src={`/images/${concert.image}.webp`}
          alt={`${concert.genre} concert atmosphere`}
          fill
          priority
          sizes="100vw"
        />
        <div className="detail-banner-overlay" />
        <Link href="/concerts" className="detail-back">
          ← All concerts
        </Link>
        <div className="detail-banner-content">
          <span className="cinema-kicker">{concert.genre}</span>
          <h1>
            {concert.artist}
            <br />
            <strong>{concert.title}</strong>
          </h1>
          <div className="detail-metadata">
            <span>
              <CinemaIcon name="calendar" />
              {concert.date}
            </span>
            <span>
              <CinemaIcon name="pin" />
              {concert.venue} · {concert.city}
            </span>
          </div>
          {concert.subtitle && <p>{concert.subtitle}</p>}
        </div>
      </div>
      <div className="detail-content">
        <div>
          <h2>Concert Details</h2>
          <p>
            {concert.genre} concert at {concert.venue}, {concert.city}.
          </p>
          <h3>Ticket Categories</h3>
          <div className="category-preview">
            {venue.categories.map((c) => (
              <div key={c.name}>
                <span style={{ background: c.color }} />
                <strong>{c.name}</strong>
                <span>
                  {Number.isFinite(event.prices[c.id])
                    ? `${money(event.prices[c.id])} USDC`
                    : "Not on sale"}
                </span>
              </div>
            ))}
          </div>
        </div>
        <aside className="detail-booking-panel">
          <span className="cinema-kicker">
            {concert.status === "presale"
              ? "Presale Tickets"
              : concert.status === "upcoming"
                ? "Upcoming Concert"
                : "Tickets Available"}
          </span>
          <p>Ticket Availability</p>
          <div className="detail-price">
            {prices.length ? Math.min(...prices) : "—"}
            <small>
              USDC <span>/ from</span>
            </small>
          </div>
          <button
            className="button primary full"
            onClick={() => setBooking(true)}
            disabled={!prices.length}
          >
            Select Seats <CinemaIcon name="arrow" size={18} />
          </button>
          <button
            className={`button secondary full ${saved ? "saved-button" : ""}`}
            onClick={() => toggleSaved(concert.id)}
            aria-pressed={saved}
          >
            <CinemaIcon name="heart" size={17} />
            {saved ? "Saved to your list" : "Save this concert"}
          </button>
        </aside>
      </div>
      <div className="detail-related">
        <PosterShelf
          title="Related Concerts"
          items={concerts.filter((c) => c.id !== concert.id)}
        />
      </div>
      {(booking || resume) && (
        <SeatBooking
          concert={concert}
          resume={resume}
          onClose={() => {
            setBooking(false);
            if (resume)
              router.replace(`/concerts/${concert.id}`, { scroll: false });
          }}
          onWallet={onWallet}
        />
      )}
    </div>
  );
}

export function ShowcaseTickets() {
  const { user } = useAuth();
  const showcase = useShowcase();
  const [pass, setPass] = useState<ShowcaseBooking | null>(null);
  const ref = useRef<HTMLDialogElement>(null);
  const bookings = showcase.bookings;
  useEffect(() => {
    const dialog = ref.current;
    if (pass) dialog?.showModal();
    return () => dialog?.close();
  }, [pass]);
  if (!bookings.length) return null;
  return (
    <section className="showcase-tickets">
      <div className="collection-heading">
        <span>Concert Bookings</span>
        <span>
          {bookings.length} {bookings.length === 1 ? "booking" : "bookings"}
        </span>
      </div>
      <div className="showcase-ticket-grid">
        {bookings.map((b) => {
          const c = concerts.find((c) => c.id === b.eventId)!;
          return (
            <article className="showcase-ticket" key={b.id}>
              <div className="showcase-ticket-photo">
                <Image
                  src={`/images/${c.image}.webp`}
                  alt=""
                  fill
                  sizes="350px"
                />
              </div>
              <div>
                <span className="cinema-kicker">
                  {b.entryStatus === "redeemed" ? "REDEEMED" : "CONFIRMED"}
                </span>
                <h3>
                  {c.artist} {c.title}
                </h3>
                <p>
                  {c.date} · {c.city}
                </p>
                <span className="mono">
                  {b.id} · {b.category}
                </span>
                {b.lineItems ? (
                  <BookingSeatDetails items={b.lineItems} />
                ) : (
                  <p>{b.seats.join(", ")}</p>
                )}
                <p>
                  {b.seats.length} tickets · {money(b.total)} USDC
                </p>
                <button
                  className="button secondary compact"
                  onClick={() => setPass(b)}
                >
                  <CinemaIcon name="ticket" size={16} />
                  View Ticket
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {pass && (
        <dialog
          className="modal"
          ref={ref}
          aria-label="Concert pass"
          onCancel={() => setPass(null)}
        >
          <div className="modal-heading">
            <h2>Ticket Details</h2>
            <button
              className="cinema-icon-button"
              aria-label="Close pass"
              onClick={() => setPass(null)}
            >
              <CinemaIcon name="close" />
            </button>
          </div>
          <div className="qr-pass">
            <span className="cinema-kicker">
              TICKET · {pass.entryStatus === "redeemed" ? "REDEEMED" : "VALID"}
            </span>
            <h3>{concerts.find((c) => c.id === pass.eventId)?.title}</h3>
            <div className="qr-code">
              <QRCode value={pass.id} size={180} />
            </div>
            <strong className="mono">{pass.id}</strong>
            {pass.lineItems ? (
              <BookingSeatDetails items={pass.lineItems} />
            ) : (
              <p>
                {pass.category} · {pass.seats.join(", ")}
              </p>
            )}
            <p>Total: {money(pass.total)} USDC</p>
            <p className="small muted">
              Payment was simulated. No funds were transferred. Gate staff check
              this booking ID.
            </p>
            {user?.role !== "customer" && (
              <Link
                className="button secondary full"
                href="/scan"
                onClick={() => setPass(null)}
              >
                Open gate check <CinemaIcon name="arrow" size={16} />
              </Link>
            )}
          </div>
        </dialog>
      )}
    </section>
  );
}

export function ProfileDashboard({
  organizer,
  onWallet,
}: {
  organizer?: boolean;
  onWallet: () => void;
}) {
  const state = useDemo();
  const showcase = useShowcase();
  const wallet = wallets.find((w) => w.id === state.wallet);
  const [organizerBookings, setOrganizerBookings] = useState<ShowcaseBooking[]>(
    [],
  );
  const [loadError, setLoadError] = useState("");
  useEffect(() => {
    let active = true;
    if (organizer)
      void demoApi<{ bookings: ShowcaseBooking[] }>("organizer/bookings")
        .then((data) => {
          if (active) setOrganizerBookings(data.bookings);
        })
        .catch((e) => {
          if (active) setLoadError(e.message);
        });
    return () => {
      active = false;
    };
  }, [organizer]);
  const bookings = organizer ? organizerBookings : showcase.bookings;
  return (
    <section className="cinema-page profile-page">
      <span className="cinema-kicker">{organizer ? "" : ""}</span>
      <h1>
        {organizer
          ? "Organizer Dashboard"
          : wallet
            ? `${wallet.name}’s Account`
            : "My Account"}
        <span className="yellow-period">.</span>
      </h1>
      <p>
        {organizer
          ? "A local view of demo bookings. No real payouts or payment confirmations."
          : ""}
      </p>
      <div className="profile-actions">
        <button className="button primary" onClick={onWallet}>
          {wallet ? "Manage demo wallet" : "Connect demo wallet"}
          <CinemaIcon name="user" size={17} />
        </button>
        <Link
          href={organizer ? "/profile" : "/organizer"}
          className="button secondary"
        >
          {organizer ? "Customer view" : "Organizer demo"}
          <CinemaIcon name="arrow" size={17} />
        </Link>
      </div>
      <div className="profile-stats">
        <div>
          <span>{organizer ? "Concert demo bookings" : "Demo bookings"}</span>
          <strong>{bookings.length}</strong>
        </div>
        <div>
          <span>{organizer ? "Simulated USDC volume" : "Saved concerts"}</span>
          <strong>
            {organizer
              ? money(bookings.reduce((n, b) => n + b.total, 0))
              : showcase.saved.length}
            <small>{organizer ? "USDC" : "shows"}</small>
          </strong>
        </div>
        <div>
          <span>
            {organizer ? "Original event tickets" : "Original demo balance"}
          </span>
          <strong>
            {organizer
              ? state.soldCount
              : wallet
                ? money(state.balances[wallet.id])
                : "—"}
            <small>{organizer ? "tickets" : "XLM"}</small>
          </strong>
        </div>
      </div>
      <div className="dashboard-section-heading">
        <h2>{organizer ? "Recent Bookings" : "Transaction History"}</h2>
        <Link href="/tickets">My tickets →</Link>
      </div>
      {bookings.length ? (
        <div className="transaction-table-wrap">
          <table className="transaction-table">
            <thead>
              <tr>
                <th>Booking / concert</th>
                <th>Seats</th>
                <th>Demo amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id}>
                  <td>
                    <strong>
                      {concerts.find((c) => c.id === b.eventId)?.title}
                    </strong>
                    <span>
                      {b.id} · {wallets.find((w) => w.id === b.wallet)?.name}
                    </span>
                  </td>
                  <td>
                    {b.lineItems ? (
                      <BookingSeatDetails items={b.lineItems} />
                    ) : (
                      b.seats.join(", ")
                    )}
                  </td>
                  <td>{money(b.total)} USDC</td>
                  <td>
                    <span className="demo-status">Demo confirmed</span>
                    <small>No on-chain transaction</small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="cinema-empty">
          <CinemaIcon name="ticket" size={35} />
          <h3>No bookings yet</h3>
          <p>Demo concert bookings will appear here.</p>
          <Link href="/concerts" className="button secondary">
            Browse Concerts <CinemaIcon name="arrow" size={16} />
          </Link>
        </div>
      )}
      {loadError && (
        <p role="alert" className="seat-error">
          {loadError}
        </p>
      )}
      {organizer && <SeatingManager />}
      <div className="dashboard-shortcuts">
        <Link href="/saved">
          <CinemaIcon name="heart" />
          <span>Saved concerts</span>
          <CinemaIcon name="arrow" size={17} />
        </Link>
        <Link href="/market">
          <CinemaIcon name="ticket" />
          <span>Resale market</span>
          <CinemaIcon name="arrow" size={17} />
        </Link>
        <Link href="/scan">
          <CinemaIcon name="grid" />
          <span>Gate check</span>
          <CinemaIcon name="arrow" size={17} />
        </Link>
      </div>
    </section>
  );
}
