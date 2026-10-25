# FairTix

A cinematic concert ticketing UI built with Next.js App Router, React, TypeScript, and Tailwind CSS. The redesign uses a dark background, gold primary actions, violet accents, a photographic featured hero, horizontal poster shelves, perspective poster previews, and independent mobile navigation.

## Run

```sh
npm ci
npm run dev
```

Open http://localhost:3000. Keep using the `dev` branch. Next.js was retained at the user's request; no Vite migration was performed.

```sh
npm run lint
npm run build
npx playwright install chromium
npm run test:ui
npm run test:seating
```

The UI smoke test expects a running development server. Override `BASE_URL` to test another local instance. It covers discovery, saved shows, search, seat booking, fee totals, QR entry, the original XLM purchase/resale workflow, narrow phone/tablet/desktop layouts, and reduced motion.

## Routes

| Route                              | Purpose                                                                       |
| ---------------------------------- | ----------------------------------------------------------------------------- |
| `/`                                | Featured concert pagination, genre filters, poster shelves, 3D poster preview |
| `/concerts`                        | Searchable concert catalog with city filters                                  |
| `/concerts/[id]`                   | Fictional concert details, seat selection, demo USDC checkout                 |
| `/upcoming`, `/presale`, `/venues` | Filtered discovery and venue browsing                                         |
| `/saved`                           | Saved concert list                                                            |
| `/event`                           | Original Iloilo After Hours demo event, unchanged 1 XLM purchase              |
| `/tickets`                         | Original tickets and showcase booking passes with QR codes                    |
| `/market`                          | Original capped XLM resale and ownership transfer                             |
| `/scan`                            | Typed ticket ID check, single redemption, duplicate refusal                   |
| `/profile`, `/account`             | Prototype wallet, bookings, and transactions without login                    |
| `/organizer`                       | Local demo booking overview and simulated totals                              |
| `/guide`                           | Original event walkthrough and planned Paiflow integration                    |

Search is available in the header and mobile bottom navigation. Hearts save concerts locally. Carousel arrows disable at the ends. Reduced motion disables hero/poster animation.

## Prototype access and data

FairTix does not require login or registration. Checkout, My Tickets, My Wallet, Transactions, organizer tools, and gate previews are accessible directly. The user menu contains ticket and wallet links, without sign-in or sign-out controls. Old authentication links redirect away and credential API endpoints are disabled. See [AUTHENTICATION.md](AUTHENTICATION.md) for the anonymous prototype storage boundary.

A random HttpOnly browser cookie keeps prototype purchases and wallet choices available after refresh. Separate browsers have separate ticket histories. Existing legacy account data is not exposed or reassigned. Payments, balances, and wallet connections are simulated; no real funds are transferred.

The original event keeps its 1 XLM price, 1.1 XLM resale cap, and 50-ticket supply. The resale market includes five seeded prototype tickets from different concerts. Each has a seller-owned fixed seat or general admission section. Buyers review a read-only venue/seat visual, reserve the listing for five minutes, connect a sample wallet, and complete simulated checkout. The server transfers the existing ticket into the buyer’s My Tickets; no new seat selection is offered. The server stores records in ignored .data/mock-accounts.json. Reset Demo clears only the current browser's purchases and sample balance.

## Seating and validation

Five illustrative venue layouts use VVIP, VIP, Gold, Silver, and General Admission categories with event-specific prices. Neon Nights and Midnight Echoes share Harbor Stage geometry while retaining separate inventory and pricing. Reservations last five minutes, including across page navigation, with up to six tickets and a 5% service fee. Receipts preserve category, section, row, seat/admission unit, accessibility, and per-ticket price.

Organizer tools edit category names/colors/prices, section geometry/capacity, accessibility, blocked seats, and mixed-category policy. Prototype organizer endpoints protect sold and reserved seats. Configuration is stored by the local server and synchronized to the UI. This mock uses a single-process write queue, not a distributed reservation system.

Run npm run lint and npm run build. With the dev server running, npm run test:prototype checks direct checkout and anonymous browser storage; npm run test:ui checks discovery, purchases/resale, QR entry, and responsive pages; npm run test:resale checks fixed-seat resale, reservation conflicts, transfer and mobile layouts; npm run test:seating checks venue maps, selections, holds, organizer controls, expiry, and mobile layouts.

## Assets and references

The four new streaming/poster references and the pasted redesign brief supersede the earlier cream/blue presentation. The original FairTix documents still inform the original ticket workflow. The unrelated PayStream concept remains out of scope.

See [ASSETS.md](ASSETS.md) for the original imagegen hero prompt, generated asset path, and licensed image sources. Assets are stored locally; original concert identities are fictional.
