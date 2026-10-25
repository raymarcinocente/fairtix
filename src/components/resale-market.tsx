"use client";
import Image from "next/image";
import { useState } from "react";
import { concerts } from "@/lib/concerts";
import { seatingFor, useSeating } from "@/lib/seating-store";
import { refreshRecords, useRecords } from "@/lib/customer-records";
import type { ResaleListing } from "@/lib/resale-types";
import ResaleCheckout from "./resale-checkout";
import { resalePreview } from "@/lib/resale-preview";

export default function ResaleMarket({ onWallet }: { onWallet: () => void }) {
  const snapshot = useSeating();
  const data = useRecords();
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [selected, setSelected] = useState<ResaleListing | null>(null);
  const listings = (data.inventoryLoaded ? data.resale : resalePreview).map((listing) => {
    const concert = concerts.find((c) => c.id === listing.eventId)!;
    const { venue } = seatingFor(snapshot, listing.eventId);
    return {
      listing,
      concert,
      venue,
      section: {
        name: listing.ticket.sectionName,
        mode: listing.ticket.row ? "numbered" : "general",
      },
      category: { name: listing.ticket.categoryName },
      seat: listing.ticket,
      price: listing.price,
      faceValue: listing.faceValue,
    };
  });
  const categories = [...new Set(listings.map((l) => l.category.name))];
  const filtered = listings.filter(
    ({ concert, venue, category }) =>
      (!categoryFilter || category.name === categoryFilter) &&
      `${concert.artist} ${concert.title} ${venue.name} ${concert.city}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  return (
    <section
      className="resale-samples resale-catalog"
      aria-label="Concert resale tickets"
    >
      <div className="resale-filters">
        <label>
          Search concerts
          <input
            type="search"
            aria-label="Search resale tickets"
            placeholder="Concert, artist or city"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label>
          Ticket category
          <select
            aria-label="Filter resale category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="resale-results-heading">
        <h2>Concert Tickets</h2>
        <span role="status">
          {filtered.length} {filtered.length === 1 ? "ticket" : "tickets"}
        </span>
      </div>
      <p className="resale-preview-note">
        Each ticket includes the seat shown. Payments are simulated.
      </p>
      {data.loading && !listings.length && (
        <p role="status">Loading resale tickets…</p>
      )}
      {data.inventoryError && (
        <div className="resale-no-results" role="alert">
          <p>Unable to refresh resale tickets. Please try again.</p>
          <button className="button secondary compact" onClick={() => void refreshRecords()}>
            Retry
          </button>
        </div>
      )}
      <div className="resale-catalog-grid">
        {filtered.map(
          ({
            listing,
            concert,
            venue,
            section,
            category,
            seat,
            faceValue,
            price,
          }) => {
            const date = concert.date.match(/^([A-Za-z]{3}) (\d{2}), (\d{4})/);
            return (
              <article
                className="owned-ticket sample-resale-card"
                key={listing.id}
              >
                <button
                  type="button"
                  onClick={() => setSelected(listing)}
                  className="sample-resale-image"
                  aria-label={`View resale ticket for ${concert.artist} ${concert.title}`}
                >
                  <Image
                    src={`/images/${concert.image}.webp`}
                    alt=""
                    fill
                    sizes="(max-width:700px) 100vw, 500px"
                  />
                  {date && (
                    <span className="resale-date">
                      <span>{date[1]}</span>
                      <strong>{date[2]}</strong>
                      <small>{date[3]}</small>
                    </span>
                  )}
                </button>
                <div className="sample-resale-body">
                  <div className="resale-ticket-category">
                    <span>{category.name}</span>
                    <span>1 ticket</span>
                  </div>
                  <h3>
                    <button
                      type="button"
                      className="resale-title-link"
                      onClick={() => setSelected(listing)}
                    >
                      {concert.artist} {concert.title}
                    </button>
                  </h3>
                  <p className="sample-resale-date">{concert.date}</p>
                  <p className="resale-location">
                    {venue.name} · {concert.city}
                  </p>
                  <p className="resale-seat">
                    {section.name}
                    {section.mode === "general"
                      ? " · General admission"
                      : seat
                        ? ` · Row ${seat.row}, Seat ${seat.number}`
                        : " · Assigned seating"}
                  </p>
                  <div className="ticket-actions">
                    <div className="sample-resale-price">
                      <small>Resale price</small>
                      <strong>
                        {price !== null
                          ? `${price.toFixed(2)} USDC`
                          : "Not on sale"}
                      </strong>
                      {price !== null && (
                        <span>Face value {faceValue.toFixed(2)} USDC</span>
                      )}
                    </div>
                    <button
                      type="button"
                      className="button primary compact"
                      onClick={() => setSelected(listing)}
                      disabled={
                        !!listing.reservedUntil && !listing.reservedByMe
                      }
                    >
                      {listing.reservedUntil && !listing.reservedByMe
                        ? "Reserved"
                        : "Buy Ticket"}
                    </button>
                  </div>
                </div>
              </article>
            );
          },
        )}
      </div>
      {selected && (
        <ResaleCheckout
          listing={selected}
          onClose={() => setSelected(null)}
          onWallet={onWallet}
        />
      )}
      {!filtered.length && !data.loading && !data.inventoryError && (
        <div className="resale-no-results">
          <h3>No matching tickets</h3>
          <p>Try another concert or ticket category.</p>
          <button
            className="button secondary compact"
            onClick={() => {
              setQuery("");
              setCategoryFilter("");
            }}
          >
            Clear Filters
          </button>
        </div>
      )}
    </section>
  );
}
