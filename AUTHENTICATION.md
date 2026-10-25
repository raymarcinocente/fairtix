# Accounts and authentication

This is a **local mock authentication backend**, not a deployed identity or payment service. Use sample details only. The existing Next.js UI and ticket flows remain in place. No additional runtime dependencies were installed.

## Try it

Run `npm run dev` and open `http://localhost:3000`. Guest browsing and seat selection remain public. Continue to Checkout requires an account. Registration returns to the selected concert, rechecks the five-minute hold, and continues to payment review. Expired or unavailable seats require a new selection.

Seed accounts: `ana@fairtix.demo`, `ben@fairtix.demo`, `organizer@fairtix.demo`, and `admin@fairtix.demo`. All use `DemoPass123!`. Registration always creates a customer; a submitted role is ignored. Seed staff accounts have access to all fictional demo events. Production requires explicit organizer-to-event assignments.

Routes: `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, `/account`, `/account/profile`, `/account/security`, `/account/wallet`, `/account/transactions`. `/profile` remains a protected account alias. `/tickets` requires an account. `/organizer` and `/scan` require a staff role, with independent API checks. The admin account-list API additionally requires administrator access.

Wallet connection is optional for account access. Link a sample wallet from checkout or My Wallet. Its displayed address is fictional and abbreviated; no ownership signature is verified. Disconnecting or changing it does not change ticket ownership. Original XLM resale transfers tickets between **accounts**, even if both use the same demo wallet. Balances belong to accounts. USDC checkout remains simulated and does not debit real funds or invent transaction hashes.

## Storage and session behavior

- `src/lib/auth-client.ts` defines the `AuthAdapter` interface and the `mockAuthAdapter` transport. UI components use this boundary rather than handling credentials or session tokens themselves.
- `src/lib/mock-account-server.ts` contains server-only account operations and a JSON repository in ignored `.data/mock-accounts.json`. Passwords use random salts and Node scrypt. Session and verification/reset token lookups use SHA-256 hashes. Demo email links in the local outbox contain the delivery token, as a real email would; this file is private server data and must never be served or committed.
- The session cookie is HttpOnly, SameSite=Lax, scoped to `/`, and Secure in production builds. Remember me persists seven days; other sessions use a browser-session cookie with an eight-hour server expiry. Login rotates the session; logout revokes it server-side. Password reset revokes all sessions, and password changes revoke other sessions. Reset links expire after 30 minutes, verification links after 24 hours, and both are one-use. Exact-origin JSON checks protect mutations. A local throttle limits repeated authentication requests.
- Account, ticket, wallet, transaction, and booking records remain server-side and in client memory only. They are cleared on account changes and logout; other tabs receive a BroadcastChannel notification. Public inventory exposes event/seat occupancy and resale listings, without private booking references or customer identities.
- Browser storage contains saved concert IDs, seating display configuration, and short-lived seat reservations only. Legacy browser ticket/booking records are removed rather than assigned to an account without ownership evidence. Legacy saved concert IDs are retained when possible.
- A reservation is registered on the server before leaving checkout for login. The server preserves its deadline, checks seat conflicts, and requires the same reservation at booking time. Writes are queued within one Next.js process and the file is replaced atomically. This is for local testing, **not** a distributed transaction implementation.

No email is sent. To test email verification or reset, request the email in the UI, then find the latest matching `outbox` entry in `.data/mock-accounts.json` and open its relative `link` on localhost. Tokens are not returned by public APIs. Unverified accounts can purchase in this demo; production checkout must enforce the chosen verification policy.

Reset Demo removes the signed-in account's demo purchases/transactions and restores that account's balance to 10 XLM. It clears saved concerts and reservations in this browser. It does not delete other accounts' tickets or shared server seating configuration.

## Node.js / SQL Server production boundary

Replace the mock transport/repository behind the same account API contract. Suggested tables: Customers (unique normalized email, password hash, verification/status, role), Sessions (unique hashed token, customer FK, expiry/revocation), EmailTokens (hashed token, purpose, expiry/consumed), WalletLinks, OrganizerEvents, Reservations, ReservationSeats, Orders, OrderLines, Tickets, Payments, Transactions, and AuditEvents. Derive customer IDs from the validated session, never from a request body. Scope all customer queries and updates by that ID; staff queries must also check event assignments.

Use SQL transactions and unique event/seat constraints for reservation acquisition, expiration, order creation, and resale. Use distributed rate limits, monitored session cleanup, audited role assignment, and HTTPS. Remove public demo seed credentials and mock reset endpoints before deployment. Connect an actual mail provider and keep delivery tokens out of logs and API responses. Review the sample Terms page before production.

Production wallet linking must issue a random, short-lived, single-use challenge bound to the authenticated account, intended network, address, and domain. Verify its Stellar signature server-side before storing a verified wallet link. No endpoint currently claims to verify a real wallet or accepts private keys.

Production checkout must create a pending order with server-computed prices, currency, network, recipient, amount, reference, and expiration. Verify the completed Stellar USDC payment server-side, enforce idempotency on its transaction identifier, and atomically confirm the order and issue tickets. The mock booking endpoint accepts only `paymentMode: "demo"`; other modes fail because live verification is not configured. Replace that explicit branch with a production payment verifier, not a frontend success flag.

## Verification

`npm run test:auth` runs browser and API checks against the running local server: public browsing, login/registration, invalid credentials, checkout return, expired holds, wallet independence, account ownership, cookie persistence, remember me, logout/revocation, staff/admin authorization, CSRF rejection, profile updates, reset, and verification. UI and seating suites cover the remaining ticket and map interactions. These are demo checks, not a production security assessment.
