"use client";
import { useEffect, useState, type CSSProperties } from "react";
import {
  sectionSeats,
  type Seat,
  type SeatStatus,
  type VenueSection,
} from "@/lib/seating-data";
import {
  resolveStatus,
  seatingFor,
  type useSeating,
} from "@/lib/seating-store";

export type SeatingSnapshot = ReturnType<typeof useSeating>;
type Bookings = { eventId: string; seats: string[] }[];
export function useSeatingClock() {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setNow(Date.now()));
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(timer);
    };
  }, []);
  return now;
}
export function StatusLegend() {
  return (
    <div className="venue-status-legend" aria-label="Seat availability legend">
      {[
        ["available", "○"],
        ["selected", "✓"],
        ["held", "◷"],
        ["sold", "×"],
        ["blocked", "／"],
      ].map(([state, icon]) => (
        <span key={state}>
          <i className={state}>{icon}</i>
          {state[0].toUpperCase() + state.slice(1)}
        </span>
      ))}
      <span>
        <i>♿</i>Accessible
      </span>
    </div>
  );
}
export function CategoryLegend({
  snapshot,
  eventId,
}: {
  snapshot: SeatingSnapshot;
  eventId: string;
}) {
  const { event, venue } = seatingFor(snapshot, eventId);
  return (
    <div className="venue-category-legend" aria-label="Ticket Categories">
      {venue.categories.map((c) => (
        <span key={c.id}>
          <i style={{ background: c.color }} />
          {c.name}
          <strong>
            {Number.isFinite(event.prices[c.id])
              ? `${event.prices[c.id].toFixed(2)} USDC`
              : "Not on sale"}
          </strong>
        </span>
      ))}
    </div>
  );
}
export function VenueMap({
  snapshot,
  eventId,
  bookings,
  now,
  selectedSection,
  onSection,
}: {
  snapshot: SeatingSnapshot;
  eventId: string;
  bookings: Bookings;
  now: number;
  selectedSection?: string | null;
  onSection: (id: string) => void;
}) {
  const { event, venue } = seatingFor(snapshot, eventId);
  const [zoom, setZoom] = useState(1);
  return (
    <div className="venue-map-panel">
      <div className="venue-map-toolbar">
        <div>
          <h3>Seating Map</h3>
          <p>{venue.name} · Demo layout</p>
        </div>
        <div className="map-zoom" aria-label="Venue map zoom">
          <button
            type="button"
            aria-label="Zoom out venue map"
            disabled={zoom === 1}
            onClick={() => setZoom(Math.max(1, zoom - 0.25))}
          >
            −
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            aria-label="Zoom in venue map"
            disabled={zoom === 2}
            onClick={() => setZoom(Math.min(2, zoom + 0.25))}
          >
            +
          </button>
          <button
            type="button"
            aria-label="Reset venue map zoom"
            onClick={() => setZoom(1)}
          >
            Reset
          </button>
        </div>
      </div>
      <div className="venue-map-scroll">
        <div className="venue-plan" style={{ width: `${zoom * 100}%` }}>
          <div className="venue-stage">
            Stage<span>Front of venue</span>
          </div>
          <svg
            className="venue-aisles"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d="M50 15V94M8 49Q50 57 92 49M8 73Q50 80 92 73" />
            <path
              className="venue-perimeter"
              d="M17 17Q50 10 83 17L97 91Q50 100 3 91Z"
            />
          </svg>
          {venue.sections.map((section) => {
            const category = venue.categories.find(
              (c) => c.id === section.categoryId,
            )!;
            const seats = sectionSeats(section);
            const available = seats.filter(
              (seat) =>
                resolveStatus(snapshot, eventId, seat, bookings, now) ===
                "available",
            ).length;
            const selected = seats.filter(
              (seat) =>
                resolveStatus(snapshot, eventId, seat, bookings, now) ===
                "selected",
            ).length;
            const price = event.prices[category.id];
            return (
              <button
                type="button"
                key={section.id}
                className={`venue-zone zone-${section.categoryId} ${selectedSection === section.id ? "active" : ""} ${selected ? "has-selection" : ""}`}
                style={
                  {
                    left: `${section.x}%`,
                    top: `${section.y}%`,
                    width: `${section.width}%`,
                    height: `${section.height}%`,
                    "--zone-color": category.color,
                  } as CSSProperties
                }
                aria-pressed={selectedSection === section.id}
                aria-label={`${section.name}, ${category.name}, ${Number.isFinite(price) ? `${price.toFixed(2)} USDC` : "not on sale"}, ${available} available${selected ? `, ${selected} selected` : ""}`}
                title={`${section.name} · ${available} available`}
                onClick={() => onSection(section.id)}
              >
                <svg
                  className="venue-zone-shape"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path
                    d={
                      section.categoryId === "vvip"
                        ? "M6 5 Q50 -2 94 5 L99 85 Q50 105 1 85 Z"
                        : section.categoryId === "vip"
                          ? section.x < 50
                            ? "M4 3 L96 10 L90 97 L1 88 Z"
                            : "M4 10 L96 3 L99 88 L10 97 Z"
                          : section.categoryId === "gold"
                            ? "M3 3 Q50 14 97 3 L99 87 Q50 105 1 87 Z"
                            : "M4 5 Q50 -2 96 5 L99 91 Q50 101 1 91 Z"
                    }
                  />
                  <path className="zone-row-markings" d="M12 18H88M12 83H88" />
                </svg>
                <strong>{section.name}</strong>
                <span>
                  {Number.isFinite(price)
                    ? `${price.toFixed(2)} USDC`
                    : "Not on sale"}
                </span>
                <small>
                  {available} available
                  {section.accessible.length ? " · ♿" : ""}
                </small>
                {selected > 0 && (
                  <b className="zone-selected-count">✓ {selected}</b>
                )}
              </button>
            );
          })}
          <span className="venue-entry-label">Entrance / rear of venue</span>
        </div>
      </div>
      <CategoryLegend snapshot={snapshot} eventId={eventId} />
      <p className="seating-demo-note">
        Demo venue layout. Select a section to choose seats or quantity.
      </p>
    </div>
  );
}
export function SectionSeats({
  snapshot,
  eventId,
  section,
  bookings,
  now,
  onSeat,
  manage = false,
}: {
  snapshot: SeatingSnapshot;
  eventId: string;
  section: VenueSection;
  bookings: Bookings;
  now: number;
  onSeat: (seat: Seat, status: SeatStatus) => void;
  manage?: boolean;
}) {
  const { event, venue } = seatingFor(snapshot, eventId);
  const category = venue.categories.find((c) => c.id === section.categoryId)!;
  const seats = sectionSeats(section);
  const [zoom, setZoom] = useState(1);
  const available = seats.filter(
    (s) => resolveStatus(snapshot, eventId, s, bookings, now) === "available",
  );
  const selected = seats.filter(
    (s) => resolveStatus(snapshot, eventId, s, bookings, now) === "selected",
  );
  return (
    <div
      className="section-seat-panel"
      style={{ "--zone-color": category.color } as CSSProperties}
    >
      <div className="section-info">
        <span className="section-category-chip">{category.name}</span>
        <h3>{section.name}</h3>
        <p>
          {Number.isFinite(event.prices[category.id])
            ? `${event.prices[category.id].toFixed(2)} USDC per ticket`
            : "Tickets are not on sale for this section."}{" "}
          · {available.length} available
        </p>
      </div>
      {section.mode === "general" && !manage ? (
        <div className="ga-quantity">
          <p>General admission · No assigned rows or seats</p>
          <div>
            <button
              type="button"
              aria-label={`Remove a ticket from ${section.name}`}
              disabled={!selected.length}
              onClick={() => onSeat(selected[selected.length - 1], "selected")}
            >
              −
            </button>
            <output aria-label={`${section.name} selected quantity`}>
              {selected.length}
            </output>
            <button
              type="button"
              aria-label={`Add a ticket from ${section.name}`}
              disabled={!available.length}
              onClick={() => onSeat(available[0], "available")}
            >
              +
            </button>
          </div>
          <p>{section.capacity} total capacity</p>
        </div>
      ) : (
        <>
          <div className="section-grid-toolbar">
            <span>Stage is at the top ↑</span>
            <div className="map-zoom">
              <button
                type="button"
                aria-label="Zoom out seats"
                disabled={zoom === 1}
                onClick={() => setZoom(Math.max(1, zoom - 0.25))}
              >
                −
              </button>
              <span>{Math.round(zoom * 100)}%</span>
              <button
                type="button"
                aria-label="Zoom in seats"
                disabled={zoom === 1.5}
                onClick={() => setZoom(Math.min(1.5, zoom + 0.25))}
              >
                +
              </button>
            </div>
          </div>
          <div className="section-grid-scroll">
            <div
              className="section-seat-grid"
              style={{ "--seat-size": `${36 * zoom}px` } as CSSProperties}
            >
              {Array.from(new Set(seats.map((s) => s.row || "GA"))).map(
                (row) => (
                  <div className="venue-seat-row" key={row}>
                    <span className="row-label">{row}</span>
                    <div>
                      {seats
                        .filter((s) => (s.row || "GA") === row)
                        .map((seat) => {
                          const status = resolveStatus(
                            snapshot,
                            eventId,
                            seat,
                            bookings,
                            now,
                          );
                          const disabled = manage
                            ? ["sold", "held", "selected"].includes(status)
                            : !["available", "selected"].includes(status);
                          const label = `${section.name}, ${seat.row ? `Row ${seat.row}, Seat ${seat.number}` : `Admission ticket ${seat.number}`}, ${status}${seat.accessible ? ", accessible" : ""}, ${event.prices[category.id]?.toFixed(2) || "not on sale"} USDC`;
                          return (
                            <button
                              type="button"
                              key={seat.id}
                              className={`venue-seat ${status} ${seat.accessible ? "accessible" : ""}`}
                              disabled={disabled}
                              aria-pressed={
                                !manage
                                  ? status === "selected"
                                  : status === "blocked"
                              }
                              aria-label={label}
                              title={label}
                              onClick={() => onSeat(seat, status)}
                            >
                              <span>{seat.number}</span>
                              <i aria-hidden="true">
                                {status === "selected"
                                  ? "✓"
                                  : status === "sold"
                                    ? "×"
                                    : status === "held"
                                      ? "◷"
                                      : status === "blocked"
                                        ? "／"
                                        : seat.accessible
                                          ? "♿"
                                          : ""}
                              </i>
                            </button>
                          );
                        })}
                    </div>
                    <span className="row-label">{row}</span>
                  </div>
                ),
              )}
            </div>
          </div>
        </>
      )}
      <StatusLegend />
      <p className="seating-demo-note">
        {manage
          ? "Select an available seat to block it, or a blocked seat to release it. Sold and held seats cannot be edited."
          : "Sold, held, and blocked seats cannot be selected. Accessible seats are marked ♿."}
      </p>
    </div>
  );
}
