"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useSyncExternalStore, type FormEvent } from "react";
import { accountAction, useAuth } from "@/lib/auth-client";
import { safeReturnTo } from "@/lib/auth-types";
import { concerts } from "@/lib/concerts";
import { useDemo, wallets, connect } from "@/lib/demo-store";
import { useShowcase } from "@/lib/showcase-store";
import { CinemaHeader } from "./cinema";
import { seatLabel } from "@/lib/seating-data";
import { refreshRecords } from "@/lib/customer-records";

export function PasswordField({
  name = "password",
  label = "Password",
  confirm = false,
  current = false,
}: {
  name?: string;
  label?: string;
  confirm?: boolean;
  current?: boolean;
}) {
  const [show, setShow] = useState(false);
  const id = useId();
  return (
    <div className="password-input-group">
      <label htmlFor={id}>{label}</label>
      <span className="password-field">
        <input
          id={id}
          name={name}
          type={show ? "text" : "password"}
          required
          minLength={current ? 1 : 12}
          maxLength={128}
          autoComplete={
            current
              ? "current-password"
              : confirm
                ? "new-password"
                : "new-password"
          }
        />
        <button
          type="button"
          aria-label={`${show ? "Hide" : "Show"} ${label.toLowerCase()}`}
          onClick={() => setShow(!show)}
        >
          {show ? "Hide" : "Show"}
        </button>
      </span>
    </div>
  );
}
export function AuthPage({ mode }: { mode: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const query = useSyncExternalStore(
    () => () => {},
    () => window.location.search,
    () => "",
  );
  const title = (
    {
      login: "Sign In",
      register: "Create Account",
      "forgot-password": "Reset Password",
      "reset-password": "Set New Password",
      "verify-email": "Verify Email",
      terms: "Terms and Conditions",
    } as Record<string, string>
  )[mode];
  const returnTo = () =>
    safeReturnTo(new URLSearchParams(window.location.search).get("returnTo"));
  const link = (path: string) =>
    `${path}?returnTo=${encodeURIComponent(safeReturnTo(new URLSearchParams(query).get("returnTo")))}`;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    const form = new FormData(e.currentTarget);
    const body = Object.fromEntries(form.entries());
    try {
      const result = await accountAction(
        (
          {
            "forgot-password": "forgot",
            "reset-password": "reset",
            "verify-email": "verify",
          } as Record<string, string>
        )[mode] || mode,
        {
          ...body,
          terms: form.get("terms") === "on",
          remember: form.get("remember") === "on",
          token: new URLSearchParams(window.location.search).get("token"),
        },
      );
      if (mode === "login" || mode === "register") {
        router.replace(returnTo());
        router.refresh();
      } else setMessage(result.message || "Account updated.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to continue.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="cinema-shell">
      <CinemaHeader view={mode} onWallet={() => {}} />
      <main className="account-container auth-container">
        <section className="account-panel">
          <h1>{title}</h1>
          {mode === "terms" ? (
            <>
              <p>
                FairTix is a demonstration. Events, wallets, balances, tickets,
                and payments are simulated. Do not enter real wallet keys or use
                this site for admission to an event.
              </p>
              <p>
                Use sample account details for testing. Account records are
                stored on this local server. No real payment is collected and no
                email is sent.
              </p>
              <Link href="/register">Back to registration</Link>
            </>
          ) : (
            <>
              <p className="account-demo-note">
                Mock authentication · Use test details only.
              </p>
              <form className="account-form" onSubmit={submit}>
                {mode === "register" && (
                  <div className="account-form-row">
                    <label>
                      First name
                      <input
                        name="firstName"
                        required
                        maxLength={100}
                        autoComplete="given-name"
                      />
                    </label>
                    <label>
                      Last name
                      <input
                        name="lastName"
                        required
                        maxLength={100}
                        autoComplete="family-name"
                      />
                    </label>
                  </div>
                )}
                {["login", "register", "forgot-password"].includes(mode) && (
                  <label>
                    Email address
                    <input
                      name="email"
                      type="email"
                      required
                      maxLength={254}
                      autoComplete="email"
                    />
                  </label>
                )}
                {["login", "register", "reset-password"].includes(mode) && (
                  <PasswordField current={mode === "login"} />
                )}
                {["register", "reset-password"].includes(mode) && (
                  <>
                    <p className="field-help">Use 12–128 characters.</p>
                    <PasswordField
                      name="confirmPassword"
                      label="Confirm password"
                      confirm
                    />
                  </>
                )}
                {mode === "login" && (
                  <div className="account-form-options">
                    <label className="checkbox-label">
                      <input type="checkbox" name="remember" />
                      Remember me
                    </label>
                    <Link href="/forgot-password">Forgot password?</Link>
                  </div>
                )}
                {mode === "register" && (
                  <label className="checkbox-label">
                    <input name="terms" type="checkbox" required />I agree to
                    the{" "}
                    <Link href="/terms" target="_blank">
                      Terms and Conditions
                    </Link>
                    .
                  </label>
                )}
                {mode === "register" && (
                  <p className="field-help">
                    Verification instructions are written to the local demo
                    outbox. Email delivery is not connected.
                  </p>
                )}
                {mode === "verify-email" && (
                  <p>
                    Confirm your email address using this verification link.
                  </p>
                )}
                {error && (
                  <p role="alert" className="seat-error">
                    {error}
                  </p>
                )}
                {message && (
                  <p role="status" className="account-message">
                    {message}
                  </p>
                )}
                <button
                  className="button primary full"
                  disabled={busy || !!message}
                  type="submit"
                >
                  {busy
                    ? "Please wait…"
                    : mode === "forgot-password"
                      ? "Request Reset"
                      : title}
                </button>
              </form>
              {mode === "login" ? (
                <p>
                  New to FairTix?{" "}
                  <Link href={link("/register")}>Create Account</Link>
                </p>
              ) : (
                <p>
                  <Link href={link("/login")}>Sign In</Link>
                </p>
              )}
              {mode === "login" && (
                <details className="demo-credentials">
                  <summary>Demo accounts</summary>
                  <p>
                    Customer: ana@fairtix.demo or ben@fairtix.demo
                    <br />
                    Organizer: organizer@fairtix.demo
                    <br />
                    Administrator: admin@fairtix.demo
                    <br />
                    Password: <code>DemoPass123!</code>
                  </p>
                </details>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
export function AccountContent({
  section = "overview",
  onWallet,
}: {
  section?: string;
  onWallet: () => void;
}) {
  const { user } = useAuth();
  const demo = useDemo();
  const showcase = useShowcase();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const wallet = wallets.find((w) => w.id === user?.wallet);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await accountAction(
        section === "security" ? "password" : "profile",
        data,
      );
      setMessage(
        section === "security"
          ? "Password updated. Other sessions have been signed out."
          : "Profile updated.",
      );
      if (section === "security") form.reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save.");
    } finally {
      setBusy(false);
    }
  }
  if (!user)
    return (
      <section className="account-container">
        <p>Loading account…</p>
      </section>
    );
  return (
    <section className="account-container">
      <h1>
        {(
          {
            overview: "My Account",
            profile: "Profile",
            security: "Security",
            wallet: "My Wallet",
            transactions: "Transaction History",
          } as Record<string, string>
        )[section] || "My Account"}
      </h1>
      <nav className="account-tabs" aria-label="Account navigation">
        {[
          ["Overview", "/account"],
          ["Profile", "/account/profile"],
          ["Security", "/account/security"],
          ["My Wallet", "/account/wallet"],
          ["Transactions", "/account/transactions"],
          ["My Tickets", "/tickets"],
        ].map(([label, url]) => (
          <Link href={url} key={url}>
            {label}
          </Link>
        ))}
      </nav>
      {demo.error && (
        <p role="alert" className="seat-error">
          {demo.error}{" "}
          <button type="button" onClick={() => void refreshRecords()}>
            Retry
          </button>
        </p>
      )}
      {error && (
        <p role="alert" className="seat-error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="account-message">
          {message}
        </p>
      )}
      {section === "profile" ? (
        <section className="account-panel">
          <form className="account-form" onSubmit={submit} key={user.id}>
            <label>
              First name
              <input
                name="firstName"
                required
                maxLength={100}
                defaultValue={user.firstName}
                autoComplete="given-name"
              />
            </label>
            <label>
              Last name
              <input
                name="lastName"
                required
                maxLength={100}
                defaultValue={user.lastName}
                autoComplete="family-name"
              />
            </label>
            <label>
              Email address
              <input
                name="email"
                required
                type="email"
                defaultValue={user.email}
                autoComplete="email"
              />
            </label>
            <p className="field-help">
              Changing your email address requires verification again.
            </p>
            <button className="button primary" disabled={busy}>
              {busy ? "Saving…" : "Save Changes"}
            </button>
          </form>
        </section>
      ) : section === "security" ? (
        <section className="account-panel">
          <form className="account-form" onSubmit={submit}>
            <PasswordField
              name="currentPassword"
              label="Current password"
              current
            />
            <PasswordField label="New password" />
            <p className="field-help">Use 12–128 characters.</p>
            <PasswordField
              name="confirmPassword"
              label="Confirm password"
              confirm
            />
            <button className="button primary" disabled={busy}>
              {busy ? "Saving…" : "Update Password"}
            </button>
          </form>
        </section>
      ) : (
        <>
          {section === "overview" && (
            <section className="account-panel">
              <h2>
                {user.firstName} {user.lastName}
              </h2>
              <dl className="account-facts">
                <dt>Email</dt>
                <dd>{user.email}</dd>
                <dt>Account status</dt>
                <dd>
                  {user.verified
                    ? "Email verified"
                    : "Email verification pending"}
                </dd>
                <dt>Role</dt>
                <dd>{user.role}</dd>
                <dt>Authentication</dt>
                <dd>Local mock account</dd>
              </dl>
              {!user.verified && (
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const result = await accountAction("resend");
                      setMessage(result.message || "");
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Request Verification
                </button>
              )}
              {user.role !== "customer" && (
                <p>
                  <Link href="/organizer">Organizer Dashboard</Link> ·{" "}
                  <Link href="/scan">Gate Check</Link>
                </p>
              )}
            </section>
          )}
          {["overview", "wallet"].includes(section) && (
            <section className="account-panel">
              <h2>Connected Wallet</h2>
              <p>
                {wallet
                  ? `${wallet.name}’s demo wallet · ${wallet.address}`
                  : "No wallet connected."}
              </p>
              {wallet && (
                <p>
                  Demo connection · Ownership has not been verified by a
                  signature.
                </p>
              )}
              <button className="button secondary" onClick={onWallet}>
                {wallet ? "Change Demo Wallet" : "Connect Demo Wallet"}
              </button>
              {wallet && (
                <button
                  className="button quiet"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await connect(null);
                      setMessage(
                        "Wallet disconnected. Your tickets remain in your account.",
                      );
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Disconnect Wallet
                </button>
              )}
            </section>
          )}
          {section === "transactions" && (
            <section className="account-panel">
              <h2>Transactions</h2>
              {!demo.transactions.length ? (
                <p>No transactions yet.</p>
              ) : (
                <div className="account-bookings">
                  {[...demo.transactions].reverse().map((t) => (
                    <article key={t.id}>
                      <h3>{concerts.find((c) => c.id === t.eventId)?.title}</h3>
                      <p>
                        {t.kind} · {t.amount.toFixed(2)} {t.currency} ·
                        Simulated payment
                      </p>
                      <p>{new Date(t.createdAt).toLocaleString()}</p>
                      <p className="mono">{t.reference}</p>
                      <Link href="/tickets">My Tickets</Link>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}
          {["overview", "wallet"].includes(section) && (
            <section className="account-panel">
              <h2>
                {section === "overview"
                  ? "Bookings & Upcoming Concerts"
                  : "Transaction History"}
              </h2>
              {demo.loading ? (
                <p>Loading bookings…</p>
              ) : !showcase.bookings.length && !demo.tickets.length ? (
                <p>No purchases yet.</p>
              ) : (
                <>
                  <div className="account-bookings">
                    {showcase.bookings.map((b) => {
                      const concert = concerts.find((c) => c.id === b.eventId);
                      return (
                        <article key={b.id}>
                          <h3>
                            {concert?.artist} {concert?.title}
                          </h3>
                          <p>
                            {concert?.venue} · {concert?.date}
                          </p>
                          <p>
                            {b.category} · {b.seats.length}{" "}
                            {b.seats.length === 1 ? "ticket" : "tickets"}
                          </p>
                          <p className="mono">{b.id}</p>
                          {b.lineItems && (
                            <p>
                              {b.lineItems
                                .map((item) => seatLabel(item))
                                .join("; ")}
                            </p>
                          )}
                          <p>
                            {b.total.toFixed(2)} USDC · Simulated payment ·{" "}
                            {new Date(b.createdAt).toLocaleDateString()}
                          </p>
                          <Link href="/tickets">View Ticket</Link>
                        </article>
                      );
                    })}
                    {demo.tickets.map((t) => (
                      <article key={t.id}>
                        <h3>Iloilo After Hours</h3>
                        <p>
                          Date and venue to be announced · General Admission
                        </p>
                        <p className="mono">{t.id}</p>
                        <p>1 XLM · Demo ticket · {t.status}</p>
                        <Link href="/tickets">View Ticket</Link>
                      </article>
                    ))}
                  </div>
                </>
              )}
            </section>
          )}
        </>
      )}
    </section>
  );
}
