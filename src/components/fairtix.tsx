"use client";

import Link from "next/link";
import Image from "next/image";
import { CinemaHeader, CinemaHome, CinemaBrowse } from "./cinema";
import {
  ConcertDetail,
  ProfileDashboard,
  ShowcaseTickets,
} from "./concert-experience";
import { concerts } from "@/lib/concerts";
import {
  redeemShowcase,
  resetShowcase,
  useShowcase,
} from "@/lib/showcase-store";
import { useEffect, useRef, useState, type ReactNode } from "react";
import QRCode from "react-qr-code";
import { useAuth } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { AccountContent } from "./account-pages";
import { refreshRecords } from "@/lib/customer-records";
import {
  buyTicket,
  cancelListing,
  CAP,
  connect,
  listTicket,
  PRICE,
  resetDemo,
  scanTicket,
  SUPPLY,
  transferTicket,
  useDemo,
  wallets,
  type Ticket,
} from "@/lib/demo-store";

export type View =
  | "home"
  | "event"
  | "tickets"
  | "market"
  | "scan"
  | "guide"
  | "concerts"
  | "upcoming"
  | "presale"
  | "venues"
  | "saved"
  | "profile"
  | "organizer"
  | "concert"
  | "account";
type IconName =
  | "ticket"
  | "arrow"
  | "shield"
  | "cap"
  | "scan"
  | "wallet"
  | "check"
  | "close"
  | "calendar"
  | "pin"
  | "plus"
  | "globe";
const paths: Record<IconName, ReactNode> = {
  ticket: (
    <>
      <path d="M3 5h18v5a2 2 0 0 0 0 4v5H3v-5a2 2 0 0 0 0-4V5Z" />
      <path d="M15 5v3m0 3v2m0 3v3" />
    </>
  ),
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  shield: (
    <>
      <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  cap: (
    <>
      <path d="M4 4h16M5 20h14M8 16V9m4 7V7m4 9v-5" />
      <path d="M4 4v2m16-2v2" />
    </>
  ),
  scan: (
    <>
      <path d="M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5M3 12h18" />
      <path d="M8 8h2v2H8zm6 6h2v2h-2z" />
    </>
  ),
  wallet: (
    <>
      <path d="M20 8V5H4a2 2 0 0 0-2 2v12h18V8H4a2 2 0 0 1 0-4" />
      <path d="M15 11h6v5h-6z" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M7 3v4m10-4v4M3 11h18" />
    </>
  ),
  pin: (
    <>
      <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <ellipse cx="12" cy="12" rx="4" ry="9" />
      <path d="M3 12h18" />
    </>
  ),
};
function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
function Logo() {
  return (
    <Link className="logo" href="/" aria-label="FairTix home">
      <span className="logo-icon">
        <Icon name="ticket" size={23} />
      </span>
      Fair<span>Tix</span>
    </Link>
  );
}
function Badge({
  children,
  tone = "blue",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
function EventArt() {
  return (
    <div className="event-art photo-art">
      <Image
        src="/images/after-hours.webp"
        alt="Original cinematic concert artwork featuring a fictional vocalist"
        fill
        sizes="(max-width:800px) 100vw, 700px"
        priority
      />
      <div className="event-art-overlay" />
      <div className="event-art-type">
        <span>Demo event · Iloilo City</span>
        <strong>
          ILOILO
          <br />
          AFTER HOURS
        </strong>
        <small></small>
      </div>
    </div>
  );
}
const steps = [
  ["Connect your wallet", "Choose Ana or Ben as your demo wallet."],
  ["Buy a Ticket", "Buy your ticket. It belongs to your wallet."],
  ["Resell a Ticket", "Resell your ticket within the organizer’s cap."],
  ["Gate Entry", "Enter the ticket ID in Gate check to validate entry."],
];

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-heading">
        <h2>{title}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
}

export default function FairTix(props: Parameters<typeof FairTixView>[0]) {
  const { identityVersion } = useAuth();
  return <FairTixView key={identityVersion} {...props} />;
}
function FairTixView({
  view,
  concertId,
  accountSection,
}: {
  view: View;
  concertId?: string;
  accountSection?: string;
}) {
  const { user, ready } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const state = useDemo();
  const showcase = useShowcase();
  const wallet = wallets.find((w) => w.id === state.wallet);
  const [walletOpen, setWalletOpen] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [purchased, setPurchased] = useState<Ticket | null>(null);
  const [listing, setListing] = useState<Ticket | null>(null);
  const [qr, setQr] = useState<Ticket | null>(null);
  const [price, setPrice] = useState("1.1");
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(
    null,
  );
  const [listingError, setListingError] = useState("");
  const [scanId, setScanId] = useState("");
  const [scanResult, setScanResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const privateView = [
    "tickets",
    "account",
    "profile",
    "organizer",
    "scan",
  ].includes(view);
  const denied =
    ["organizer", "scan"].includes(view) && user?.role === "customer";
  useEffect(() => {
    if (!ready || !privateView) return;
    if (!user)
      router.replace(
        `/login?returnTo=${encodeURIComponent(view === "account" && accountSection ? `/account/${accountSection}` : `/${view}`)}`,
      );
    else if (denied) router.replace("/account?access=denied");
  }, [ready, privateView, user, denied, router, view, accountSection]);
  const mine = state.tickets;
  const market = state.market;
  async function attempt(action: () => unknown, success: string) {
    try {
      await action();
      setMessage({ text: success, ok: true });
    } catch (e) {
      setMessage({
        text: e instanceof Error ? e.message : "Please try again.",
        ok: false,
      });
    }
  }
  function startCheckout() {
    if (!ready) return;
    setMessage(null);
    if (!user) {
      router.push("/login?returnTo=%2Fevent%3Fcheckout%3D1");
      return;
    }
    if (!wallet) setWalletOpen(true);
    else setCheckout(true);
  }
  useEffect(() => {
    let active = true;
    if (
      view === "event" &&
      user &&
      new URLSearchParams(window.location.search).get("checkout") === "1"
    ) {
      void refreshRecords().then(() => {
        if (active) {
          if (user.wallet) setCheckout(true);
          else setWalletOpen(true);
        }
      });
    }
    return () => {
      active = false;
    };
  }, [view, user]);
  function ticketCard(ticket: Ticket, resale = false) {
    const owner = wallets.find((w) => w.id === ticket.owner);
    return (
      <article className="owned-ticket" key={ticket.id}>
        <div className="ticket-card-top">
          <span className="eyebrow">GENERAL ADMISSION</span>
          <Badge
            tone={
              ticket.status === "redeemed"
                ? "gray"
                : ticket.status === "listed"
                  ? "blue"
                  : "green"
            }
          >
            {ticket.status === "valid"
              ? "Valid"
              : ticket.status === "listed"
                ? "Listed"
                : "Redeemed"}
          </Badge>
        </div>
        <h3>Iloilo After Hours</h3>
        <p className="muted">Sample event · Iloilo City</p>
        <div className="ticket-details">
          <span className="mono">{ticket.id}</span>
          <span>
            {owner?.address}
            {state.tickets.some((t) => t.id === ticket.id) ? " (you)" : ""}
          </span>
        </div>
        <div className="ticket-actions">
          {resale ? (
            <>
              <strong>
                {ticket.price} <small>XLM</small>
              </strong>
              {state.tickets.some((t) => t.id === ticket.id) ? (
                <Link className="button secondary compact" href="/tickets">
                  Your listing <Icon name="arrow" size={16} />
                </Link>
              ) : (
                <button
                  className="button primary compact"
                  onClick={() => {
                    if (!user) {
                      router.push("/login?returnTo=%2Fmarket");
                      return;
                    }
                    if (!wallet) setWalletOpen(true);
                    else
                      attempt(
                        () => transferTicket(ticket.id),
                        `${ticket.id} transferred to your wallet. View it in My Tickets.`,
                      );
                  }}
                >
                  Buy for {ticket.price} XLM
                </button>
              )}
            </>
          ) : (
            <>
              {ticket.status === "valid" && (
                <button
                  className="button secondary compact"
                  onClick={() => {
                    setListing(ticket);
                    setPrice("1.1");
                    setListingError("");
                  }}
                >
                  List for resale <Icon name="arrow" size={16} />
                </button>
              )}
              {ticket.status === "listed" && (
                <button
                  className="button secondary compact"
                  onClick={() =>
                    attempt(
                      () => cancelListing(ticket.id),
                      "Listing removed. Your ticket is valid again.",
                    )
                  }
                >
                  Cancel listing
                </button>
              )}
              <button
                className="button quiet compact"
                onClick={() => setQr(ticket)}
              >
                <Icon name="scan" size={16} />
                {ticket.status === "redeemed" ? "View pass" : "Show QR"}
              </button>
            </>
          )}
        </div>
      </article>
    );
  }
  if (privateView && (!ready || !user || denied))
    return (
      <main className="account-container">
        <p>Loading account…</p>
      </main>
    );
  return (
    <>
      <CinemaHeader
        view={view}
        walletName={wallet?.name}
        onWallet={() => setWalletOpen(true)}
      />
      <main>
        {message && (
          <div
            className={`container notification ${message.ok ? "success" : "error"}`}
            role="status"
          >
            <Icon name={message.ok ? "check" : "close"} />
            <span>{message.text}</span>
            <button
              className="icon-button"
              onClick={() => setMessage(null)}
              aria-label="Dismiss message"
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        )}
        {view === "home" && <CinemaHome />}
        {["concerts", "upcoming", "presale", "venues", "saved"].includes(
          view,
        ) && <CinemaBrowse view={view} />}
        {(view === "account" || view === "profile") && (
          <AccountContent
            section={accountSection}
            onWallet={() => setWalletOpen(true)}
          />
        )}
        {view === "organizer" && (
          <ProfileDashboard
            organizer={view === "organizer"}
            onWallet={() => setWalletOpen(true)}
          />
        )}
        {view === "concert" && (
          <ConcertDetail
            concert={concerts.find((c) => c.id === concertId)!}
            onWallet={() => setWalletOpen(true)}
          />
        )}

        {view === "event" && (
          <section className="container page-section">
            <div className="breadcrumbs">
              <Link href="/">Home</Link>
              <span>/</span>View Event
            </div>
            <div className="event-layout">
              <div>
                <EventArt />
                <div className="event-description">
                  <Badge tone="blue">Live music · Demo event</Badge>
                  <h1>Iloilo After Hours</h1>
                  <p className="large-copy"></p>
                  <div className="event-meta">
                    <span>
                      <Icon name="calendar" /> Date to be announced
                    </span>
                    <span>
                      <Icon name="pin" /> Iloilo City · Venue to be announced
                    </span>
                  </div>
                  <h3>Event Details</h3>
                  <p>
                    A demo live music event in Iloilo City. The date and venue
                    have not been announced.
                  </p>
                  <div className="inline-note">
                    <Icon name="shield" />
                    <p>
                      <strong>Resale limit:</strong> 1.1 XLM per ticket.
                      Listings above this price are rejected.
                    </p>
                  </div>
                </div>
              </div>
              <aside className="booking-card">
                <div className="panel-heading">
                  <span className="eyebrow"></span>
                  <Badge tone="green">
                    <span className="live-dot" /> Demo event
                  </Badge>
                </div>
                <h2>General admission</h2>
                <p></p>
                <div className="booking-price">
                  1 <span>XLM</span>
                </div>
                <div className="pricing-row">
                  <span>Resale price cap</span>
                  <strong>
                    1.1 XLM <Icon name="shield" size={15} />
                  </strong>
                </div>
                <div className="pricing-row">
                  <span>Tickets available</span>
                  <strong>
                    {SUPPLY - state.soldCount} / {SUPPLY}
                  </strong>
                </div>
                <div className="supply-track">
                  <span
                    style={{
                      width: `${((SUPPLY - state.soldCount) / SUPPLY) * 100}%`,
                    }}
                  />
                </div>
                <button
                  className="button primary full"
                  disabled={!ready || state.soldCount >= SUPPLY}
                  onClick={startCheckout}
                >
                  {state.soldCount >= SUPPLY
                    ? "Sold out"
                    : wallet
                      ? "Buy ticket · 1 XLM"
                      : user
                        ? "Connect wallet to buy"
                        : "Buy Tickets"}
                  <Icon name="arrow" />
                </button>
                <div className="booking-note">
                  <Icon name="shield" size={16} /> Ticket ownership and entry
                  are recorded by the local demo server.
                </div>
                <div className="demo-disclosure">
                  <strong>Demo checkout</strong>
                  <p>
                    Demo balances only. No Freighter connection or Paiflow
                    payment is made.
                  </p>
                </div>
              </aside>
            </div>
          </section>
        )}

        {view === "tickets" && (
          <section className="container page-section">
            <div className="page-heading">
              <div>
                <span className="eyebrow"></span>
                <h1>
                  My tickets<span className="heading-dot">.</span>
                </h1>
                <p></p>
              </div>
              <Link href="/event" className="button secondary">
                View Event <Icon name="arrow" />
              </Link>
            </div>
            <ShowcaseTickets />
            {state.error && (
              <p className="seat-error" role="alert">
                {state.error}{" "}
                <button onClick={() => void refreshRecords()}>Retry</button>
              </p>
            )}
            <>
              <div className="collection-heading">
                <span>
                  {mine.length} {mine.length === 1 ? "ticket" : "tickets"}
                </span>
                <span className="mono">
                  {user?.firstName} {user?.lastName}
                </span>
              </div>
              {state.loading ? (
                <p>Loading tickets…</p>
              ) : mine.length ? (
                <div className="ticket-grid">
                  {mine.map((t) => ticketCard(t))}
                </div>
              ) : showcase.bookings.length > 0 ? (
                <p className="small muted">
                  No original Iloilo After Hours tickets. Explore the original
                  event for XLM resale.
                </p>
              ) : (
                <Empty
                  icon="ticket"
                  title="No tickets yet"
                  body="Tickets purchased with your account will appear here."
                  action={
                    <Link className="button primary" href="/event">
                      Browse Concerts <Icon name="arrow" />
                    </Link>
                  }
                />
              )}
            </>
            <div className="inline-note">
              <Icon name="shield" />
              <p>
                Tickets can be listed for up to <strong>1.1 XLM</strong>.
                Redeemed tickets can’t be resold.
              </p>
            </div>
          </section>
        )}

        {view === "market" && (
          <section className="container page-section">
            <div className="page-heading">
              <div>
                <span className="eyebrow"></span>
                <h1>
                  Resale market<span className="heading-dot">.</span>
                </h1>
                <p></p>
              </div>
              <Badge tone="green">
                <Icon name="shield" size={16} /> Maximum 1.1 XLM
              </Badge>
            </div>
            <div className="market-banner">
              <Icon name="cap" size={28} />
              <div>
                <strong>Resale Price Limit</strong>
                <p>
                  Every listing stays within the organizer’s 1.1 XLM cap. Demo
                  transfers use app rules; resale payments aren’t routed through
                  Paiflow.
                </p>
              </div>
            </div>
            <div className="collection-heading">
              <span>
                {market.length} available{" "}
                {market.length === 1 ? "listing" : "listings"}
              </span>
              <span>Iloilo After Hours · General admission</span>
            </div>
            {market.length ? (
              <div className="ticket-grid">
                {market.map((t) => ticketCard(t, true))}
              </div>
            ) : (
              <Empty
                icon="ticket"
                title="No resale listings"
                body="List a ticket from My Tickets to make it available for resale."
                action={
                  <Link className="button secondary" href="/tickets">
                    Go to My tickets <Icon name="arrow" />
                  </Link>
                }
              />
            )}
          </section>
        )}

        {view === "scan" && (
          <section className="container page-section">
            <div className="page-heading">
              <div>
                <span className="eyebrow"></span>
                <h1>
                  Gate Check<span className="heading-dot">.</span>
                </h1>
                <p>
                  Check a ticket’s current demo status before letting it in.
                </p>
              </div>
              <Badge tone="gray">Demo staff view</Badge>
            </div>
            <div className="scanner-layout">
              <div className="scanner-panel">
                <div className="scanner-window">
                  <div className="scan-corners">
                    <Icon name="scan" size={70} />
                  </div>
                  <span>Ticket ID check</span>
                  <small>Type the ID shown on a FairTix pass below.</small>
                </div>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const id = scanId.trim().toUpperCase();
                    try {
                      setScanResult(
                        await (id.startsWith("DEMO-")
                          ? redeemShowcase(id)
                          : scanTicket(id)),
                      );
                    } catch (e) {
                      setScanResult({
                        ok: false,
                        message: (e as Error).message,
                      });
                    }
                  }}
                >
                  <label htmlFor="ticket-id">Ticket ID</label>
                  <div className="input-action">
                    <input
                      id="ticket-id"
                      value={scanId}
                      onChange={(e) => setScanId(e.target.value)}
                      placeholder="FTX-0001"
                      required
                      autoComplete="off"
                    />
                    <button className="button primary" type="submit">
                      Check ticket <Icon name="arrow" size={18} />
                    </button>
                  </div>
                </form>
                {scanResult && (
                  <div
                    role="status"
                    className={`scan-result ${scanResult.ok ? "success" : "error"}`}
                  >
                    <Icon name={scanResult.ok ? "check" : "close"} size={32} />
                    <div>
                      <h3>{scanResult.message}</h3>
                      <p>
                        {scanId.toUpperCase()}
                        {scanResult.ok
                          ? " · Now marked redeemed"
                          : " · No entry granted"}
                      </p>
                    </div>
                  </div>
                )}
                <p className="small muted">
                  This demo checks the saved ticket status, not the QR image. A
                  second check is refused after redemption. Camera scanning
                  isn’t connected.
                </p>
              </div>
              <aside className="scan-history">
                <h3>Recent checks</h3>
                <p className="muted small">Latest first · This browser only</p>
                {state.history.length ? (
                  state.history.map((entry, i) => (
                    <div className="history-item" key={`${entry.id}-${i}`}>
                      <span className={entry.ok ? "green-text" : "red-text"}>
                        <Icon name={entry.ok ? "check" : "close"} />
                      </span>
                      <div>
                        <strong className="mono">{entry.id || "No ID"}</strong>
                        <p>{entry.message}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="history-empty">
                    No tickets checked yet.
                    <br />
                  </p>
                )}
              </aside>
            </div>
          </section>
        )}

        {view === "guide" && (
          <section className="container page-section guide-page">
            <div className="page-heading">
              <div>
                <span className="eyebrow"></span>
                <h1>
                  How It Works<span className="heading-dot">.</span>
                </h1>
                <p></p>
              </div>
            </div>
            <div className="guide-steps">
              {steps.map(([title, body], i) => (
                <article key={title}>
                  <span className="step-number mono">0{i + 1}</span>
                  <div>
                    <h2>{title}</h2>
                    <p>
                      {body}{" "}
                      {
                        [
                          "Sign into a FairTix account, then choose Ana or Ben’s sample wallet at checkout. Each account starts with 10 demo XLM. No wallet extension is needed.",
                          "Open the event and review the 1 XLM price. Complete the demo checkout to add a ticket to My tickets.",
                          "Choose List for resale. A price above 1.1 XLM is rejected. Sign into another customer account to purchase the listing.",
                          "Open Show QR on your pass. In Gate check, enter its ticket ID. The first check redeems it; the next one is refused.",
                        ][i]
                      }
                    </p>
                  </div>
                </article>
              ))}
            </div>
            <div className="integration-card">
              <Badge tone="blue">{null}</Badge>
              <h2>
                Planned Payment
                <br />
                Integration
              </h2>
              <div className="payment-flow">
                <span>Fan pays 1 XLM</span>
                <Icon name="arrow" />
                <span>On Receive → Pay</span>
                <Icon name="arrow" />
                <span>Organizer wallet</span>
              </div>
              <p>
                The intended integration issues a ticket only after payout
                confirmation. This UI demo simulates checkout and doesn’t
                connect to Paiflow or Stellar. The resale cap is an app rule.
              </p>
            </div>
            <h2 className="faq-title">Frequently Asked Questions</h2>
            {[
              [
                "Is this real money?",
                "No. This is an interactive UI prototype with demo balances. No payment, testnet transaction, or wallet signature is created.",
              ],
              [
                "What happens if I list above the cap?",
                "The app rejects the listing. You keep your ticket, and you can try again with a price at or below 1.1 XLM.",
              ],
              [
                "Can someone reuse my QR?",
                "After a ticket is redeemed, the demo refuses another entry for that ticket ID. Production entry will need a secure server-backed check.",
              ],
              [
                "Where is my demo saved?",
                "Tickets and balances belong to your signed-in account on this local demo server. Reset Demo clears your purchases and restores your balance to 10 XLM.",
              ],
            ].map(([q, a]) => (
              <details key={q}>
                <summary>
                  {q}
                  <Icon name="plus" size={18} />
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </section>
        )}
      </main>
      <footer className="site-footer">
        <div className="container footer-top">
          <div>
            <Logo />
            <p></p>
          </div>
          <div className="footer-links">
            <Link href="/guide">How it works</Link>
            <Link
              href="/scan"
              aria-current={view === "scan" ? "page" : undefined}
            >
              Gate check <span>↗</span>
            </Link>
            <button onClick={() => setResetOpen(true)}>Reset demo</button>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>© 2026 FairTix</span>
          <span>
            <span className="live-dot" /> UI demo · No real payments · Stellar
            Testnet planned
          </span>
        </div>
      </footer>

      {walletOpen && (
        <Modal
          title={wallet ? "Your demo wallet" : "Connect Demo Wallet"}
          onClose={() => setWalletOpen(false)}
        >
          <p className="modal-intro">
            Choose a demo wallet. No Freighter connection is required.
          </p>
          <div className="wallet-options">
            {wallets.map((w) => (
              <button
                className={`wallet-option ${state.wallet === w.id ? "selected" : ""}`}
                key={w.id}
                onClick={async () => {
                  try {
                    await connect(w.id);
                  } catch (e) {
                    setMessage({ text: (e as Error).message, ok: false });
                    return;
                  }
                  setWalletOpen(false);
                  setMessage(null);
                }}
              >
                <span className={`avatar ${w.id}`}>{w.name[0]}</span>
                <span>
                  <strong>{w.name}’s demo wallet</strong>
                  <small className="mono">
                    {w.address} · {state.balances[w.id].toFixed(2)} XLM
                  </small>
                </span>
                <Icon name={state.wallet === w.id ? "check" : "arrow"} />
              </button>
            ))}
          </div>
          {wallet && (
            <button
              className="button secondary full"
              onClick={async () => {
                try {
                  await connect(null);
                } catch (e) {
                  setMessage({ text: (e as Error).message, ok: false });
                  return;
                }
                setWalletOpen(false);
              }}
            >
              Disconnect wallet
            </button>
          )}
          <p className="modal-footnote">
            <Icon name="shield" size={15} /> Demo XLM only. No signatures or
            payments.
          </p>
        </Modal>
      )}
      {checkout && (
        <Modal
          title={purchased ? "Purchase Complete" : "Checkout"}
          onClose={() => {
            setCheckout(false);
            setPurchased(null);
          }}
        >
          {purchased ? (
            <div className="purchase-success">
              <span className="success-orb">
                <Icon name="check" size={32} />
              </span>
              <h3>Your demo ticket is ready.</h3>
              <p>Iloilo After Hours · General admission</p>
              <div className="receipt">
                <div>
                  <span>Ticket ID</span>
                  <strong className="mono">{purchased.id}</strong>
                </div>
                <div>
                  <span>Owner</span>
                  <strong>{wallet?.address}</strong>
                </div>
                <div>
                  <span>Demo amount</span>
                  <strong>1 XLM</strong>
                </div>
                <div>
                  <span>Payment</span>
                  <strong>Simulated · No transaction</strong>
                </div>
              </div>
              <Link
                href="/tickets"
                className="button primary full"
                onClick={() => {
                  setCheckout(false);
                  setPurchased(null);
                }}
              >
                My Tickets <Icon name="arrow" />
              </Link>
            </div>
          ) : (
            <>
              <Badge tone="blue">DEMO CHECKOUT</Badge>
              <h3 className="checkout-event">Iloilo After Hours</h3>
              <p className="muted">General admission · 1 ticket</p>
              <div className="receipt">
                <div>
                  <span>Ticket price</span>
                  <strong>{PRICE} XLM</strong>
                </div>
                <div>
                  <span>Demo buyer</span>
                  <strong>{wallet?.address}</strong>
                </div>
                <div>
                  <span>Available balance</span>
                  <strong>
                    {wallet ? state.balances[wallet.id].toFixed(2) : "0"} XLM
                  </strong>
                </div>
                <div>
                  <span>Total</span>
                  <strong>1 XLM</strong>
                </div>
              </div>
              <div className="inline-note">
                <Icon name="globe" />
                <p>
                  In the connected version, Paiflow will receive the payment and
                  pay the organizer. This checkout only uses your demo balance.
                </p>
              </div>
              <button
                className="button primary full"
                disabled={busy}
                onClick={async () => {
                  if (busy) return;
                  setBusy(true);
                  try {
                    setPurchased(await buyTicket());
                  } catch (e) {
                    setCheckout(false);
                    setMessage({
                      text:
                        e instanceof Error
                          ? e.message
                          : "Unable to buy ticket.",
                      ok: false,
                    });
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Complete demo purchase <Icon name="arrow" />
              </button>
            </>
          )}
        </Modal>
      )}
      {listing && (
        <Modal title="List for Resale" onClose={() => setListing(null)}>
          <p className="modal-intro">
            List <strong>{listing.id}</strong> for Iloilo After Hours. Your
            price must stay within the organizer’s cap.
          </p>
          <div className="cap-callout">
            <Icon name="shield" />
            <span>Maximum resale price</span>
            <strong>1.1 XLM</strong>
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await listTicket(listing.id, Number(price));
                setListing(null);
                setMessage({
                  text: `${listing.id} is listed for ${price} XLM. Sign into another customer account to buy it.`,
                  ok: true,
                });
              } catch (e) {
                setListingError(
                  e instanceof Error ? e.message : "Unable to list ticket.",
                );
              }
            }}
          >
            <label htmlFor="resale-price">Your resale price (XLM)</label>
            <input
              id="resale-price"
              type="number"
              step="any"
              min="0.0000001"
              value={price}
              onChange={(e) => {
                setPrice(e.target.value);
                setListingError("");
              }}
              required
            />
            <p
              className={`price-hint ${Number(price) > CAP ? "red-text" : Number(price) > 0 ? "green-text" : "muted"}`}
            >
              {Number(price) > CAP
                ? `${(Number(price) - CAP).toFixed(2)} XLM over the 1.1 XLM cap`
                : Number(price) > 0
                  ? "Within the 1.1 XLM resale cap."
                  : "Enter a price above 0 XLM."}
            </p>
            {listingError && (
              <div className="form-error" role="alert">
                {listingError}
              </div>
            )}
            <button className="button primary full" type="submit">
              Submit listing <Icon name="arrow" />
            </button>
          </form>
          <p className="modal-footnote">App rule · Demo resale payment only</p>
        </Modal>
      )}
      {qr && (
        <Modal title="Ticket Details" onClose={() => setQr(null)}>
          <div className="qr-pass">
            <Badge tone={qr.status === "redeemed" ? "gray" : "green"}>
              {qr.status === "valid"
                ? "Ready for entry"
                : qr.status === "listed"
                  ? "Listed · Cancel listing before entry"
                  : "Already redeemed"}
            </Badge>
            <h3>Iloilo After Hours</h3>
            <div className="qr-code">
              <QRCode value={qr.id} size={180} />
            </div>
            <strong className="mono">{qr.id}</strong>
            <p>{wallets.find((w) => w.id === qr.owner)?.address}</p>
            <p className="small muted">
              Gate staff check the ticket ID in this QR code.
            </p>
            {user?.role !== "customer" && (
              <Link
                className="button secondary full"
                href="/scan"
                onClick={() => setQr(null)}
              >
                Open gate check <Icon name="arrow" />
              </Link>
            )}
          </div>
        </Modal>
      )}
      {resetOpen && (
        <Modal title="Reset Demo?" onClose={() => setResetOpen(false)}>
          <p className="modal-intro">
            This removes your account’s demo purchases and transactions,
            restores your demo balance to 10 XLM, and clears saved concerts and
            seat reservations in this browser. Other accounts are unchanged.
          </p>
          <button
            className="button primary full"
            onClick={async () => {
              try {
                await resetDemo();
              } catch (e) {
                setMessage({ text: (e as Error).message, ok: false });
                return;
              }
              resetShowcase();
              setResetOpen(false);
              setMessage({
                text: "Your demo purchases were cleared. Your balance is 10 XLM.",
                ok: true,
              });
              setScanResult(null);
            }}
          >
            Reset demo
          </button>
          <button
            className="button quiet full"
            onClick={() => setResetOpen(false)}
          >
            Cancel
          </button>
        </Modal>
      )}
    </>
  );
}
function Empty({
  icon,
  title,
  body,
  action,
}: {
  icon: IconName;
  title: string;
  body: string;
  action: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon name={icon} size={34} />
      </span>
      <h2>{title}</h2>
      <p>{body}</p>
      {action}
    </div>
  );
}
