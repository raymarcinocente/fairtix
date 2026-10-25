# Prototype access

FairTix currently has no customer authentication. Browsing, seating, checkout, tickets, wallet history, organizer tools, and gate previews work without registration or passwords. The user icon opens My Tickets, My Wallet, Transactions, and Saved Concerts.

Old login, registration, verification, reset, and profile/security links redirect to the homepage or wallet overview. Credential API endpoints return 410. No passwords are created or accepted. The anonymous prototype adapter initializes automatically on page load.

An HttpOnly SameSite cookie stores a random browser identifier for 30 days. It keeps wallet choices, tickets, and transaction history in the same browser without a user account. Browser contexts have separate records. Customer identifiers are assigned by the server rather than accepted from a request. Legacy account data remains private and is not automatically assigned to prototype visitors. Account-management APIs are disabled.

Public organizer tools edit the shared fictional seating configuration; booking history and scanning are scoped to the current browser. This mode is for prototype use only. Payments and wallet connections remain simulated. No real funds, signatures, or transaction hashes are created.

The local JSON repository remains in ignored `.data/mock-accounts.json`; browser storage contains saved concert IDs and temporary seating reservations. Reset Demo clears only the current browser's prototype purchases and restores its sample balance.

Run `npm run test:prototype` with the local server running to check direct checkout, wallet connection, ticket persistence, browser separation, disabled account endpoints, organizer access, and scanning. `npm run test:seating` covers map interactions and configuration. Production deployment would require a separate identity, authorization, payment verification, and database implementation.
