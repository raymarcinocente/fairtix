"use client";
import { useState, type CSSProperties } from "react";
import { concerts } from "@/lib/concerts";
import {
  sectionSeats,
  type EventSeating,
  type VenueLayout,
} from "@/lib/seating-data";
import {
  resolveStatus,
  saveEventSeating,
  saveVenue,
  seatingFor,
  setSeatBlocked,
  useSeating,
} from "@/lib/seating-store";
import { useShowcase } from "@/lib/showcase-store";
import { demoApi } from "@/lib/auth-client";
import {
  SectionSeats,
  useSeatingClock,
  VenueMap,
  type SeatingSnapshot,
} from "./seating-map";

export default function SeatingManager() {
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(
    null,
  );
  const snapshot = useSeating();
  const [eventId, setEventId] = useState("neon-nights");
  const [sectionId, setSectionId] = useState("vvip-front");
  const { event, venue } = seatingFor(snapshot, eventId);
  return (
    <section className="seating-manager">
      <div className="dashboard-section-heading">
        <h2>Seating Management</h2>
        <span className="badge gray">Local demo</span>
      </div>
      <label htmlFor="seating-event">Concert</label>
      <select
        id="seating-event"
        disabled={!snapshot.session}
        value={eventId}
        onChange={(e) => setEventId(e.target.value)}
      >
        {concerts
          .filter((c) => c.id !== "event-1")
          .map((c) => (
            <option value={c.id} key={c.id}>
              {c.artist} {c.title} · {c.venue}
            </option>
          ))}
      </select>
      <p className="seating-demo-note">
        Venue geometry is shared by concerts using the same venue. Prices,
        category rules, and blocked tickets are event-specific. Changes are
        saved in this browser.
      </p>
      {message && (
        <p
          className={`manager-message ${message.ok ? "success" : "error"}`}
          role="status"
        >
          {message.text}
        </p>
      )}
      <fieldset
        className="seating-config-boundary"
        disabled={!snapshot.session}
      >
        <SeatingEditor
          onMessage={setMessage}
          sectionId={sectionId}
          setSectionId={setSectionId}
          key={eventId + JSON.stringify(event) + JSON.stringify(venue)}
          snapshot={snapshot}
          event={event}
          venue={venue}
        />
      </fieldset>
    </section>
  );
}
function SeatingEditor({
  snapshot,
  event,
  venue,
  onMessage: setMessage,
  sectionId,
  setSectionId,
}: {
  snapshot: SeatingSnapshot;
  event: EventSeating;
  venue: VenueLayout;
  onMessage: (message: { text: string; ok: boolean }) => void;
  sectionId: string;
  setSectionId: (id: string) => void;
}) {
  const [draftVenue, setDraftVenue] = useState(() => structuredClone(venue));
  const [draftEvent, setDraftEvent] = useState(() => structuredClone(event));
  const showcase = useShowcase();
  const now = useSeatingClock();
  const selected =
    draftVenue.sections.find((s) => s.id === sectionId) ||
    draftVenue.sections[0];
  const actualSection =
    venue.sections.find((s) => s.id === sectionId) || venue.sections[0];
  const allSeats = venue.sections.flatMap(sectionSeats);
  const counts = Object.fromEntries(
    ["available", "selected", "held", "sold", "blocked"].map((status) => [
      status,
      allSeats.filter(
        (seat) =>
          resolveStatus(
            snapshot,
            event.eventId,
            seat,
            showcase.inventory,
            now,
          ) === status,
      ).length,
    ]),
  );
  function updateSection(field: string, value: string | number | string[]) {
    const limits: Record<string, number> = {
      rows: 26,
      seatsPerRow: 30,
      capacity: 1000,
    };
    if (typeof value === "number" && limits[field])
      value = Math.min(limits[field], Math.max(0, value));
    setDraftVenue({
      ...draftVenue,
      sections: draftVenue.sections.map((s) =>
        s.id === selected.id ? { ...s, [field]: value } : s,
      ),
    });
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (
        Object.values(draftEvent.prices).some(
          (v) => !Number.isFinite(v) || v <= 0,
        )
      )
        throw new Error(
          "Prices must be greater than 0 USDC. Leave a price blank to stop sales in that category.",
        );
      await demoApi("organizer/config", {
        event: draftEvent,
        venue: draftVenue,
      });
      saveVenue(draftVenue, showcase.inventory);
      saveEventSeating(draftEvent);
      setMessage({ text: "Seating configuration saved.", ok: true });
    } catch (error) {
      setMessage({
        text:
          error instanceof Error
            ? error.message
            : "Unable to save seating configuration.",
        ok: false,
      });
    }
  }
  const preview = {
    ...snapshot,
    venues: snapshot.venues.map((v) => (v.id === venue.id ? draftVenue : v)),
    events: snapshot.events.map((v) =>
      v.eventId === event.eventId ? draftEvent : v,
    ),
  };
  return (
    <>
      <div className="inventory-stat-row">
        {Object.entries(counts).map(([status, count]) => (
          <div key={status}>
            <span>{status[0].toUpperCase() + status.slice(1)}</span>
            <strong>{count}</strong>
          </div>
        ))}
      </div>
      <form className="seating-config-form" onSubmit={save}>
        <h3>Ticket Categories</h3>
        <div className="manager-categories">
          {draftVenue.categories.map((category) => (
            <div className="manager-category-row" key={category.id}>
              <input
                aria-label={`Color for ${category.name}`}
                type="color"
                value={category.color}
                onChange={(e) =>
                  setDraftVenue({
                    ...draftVenue,
                    categories: draftVenue.categories.map((c) =>
                      c.id === category.id
                        ? { ...c, color: e.target.value }
                        : c,
                    ),
                  })
                }
              />
              <label>
                Category name
                <input
                  aria-label={`Category name ${category.id}`}
                  value={category.name}
                  required
                  onChange={(e) =>
                    setDraftVenue({
                      ...draftVenue,
                      categories: draftVenue.categories.map((c) =>
                        c.id === category.id
                          ? { ...c, name: e.target.value }
                          : c,
                      ),
                    })
                  }
                />
              </label>
              <label>
                Price (USDC)
                <input
                  aria-label={`Price for ${category.id}`}
                  type="number"
                  min="0.01"
                  max="1000000"
                  step="0.01"
                  value={draftEvent.prices[category.id] ?? ""}
                  placeholder="Not on sale"
                  onChange={(e) => {
                    const prices = { ...draftEvent.prices };
                    if (e.target.value === "") delete prices[category.id];
                    else prices[category.id] = Number(e.target.value);
                    setDraftEvent({ ...draftEvent, prices });
                  }}
                />
              </label>
              <span
                className="manager-category-count"
                style={{ "--zone-color": category.color } as CSSProperties}
              >
                {draftVenue.sections
                  .filter((s) => s.categoryId === category.id)
                  .reduce((sum, s) => sum + sectionSeats(s).length, 0)}{" "}
                tickets
              </span>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="button secondary compact"
          onClick={() =>
            setDraftVenue({
              ...draftVenue,
              categories: [
                ...draftVenue.categories,
                {
                  id: `cat-${crypto.randomUUID().slice(0, 8)}`,
                  name: "New Category",
                  color: "#F29CC3",
                },
              ],
            })
          }
        >
          Add Ticket Category
        </button>
        <label className="mixed-category-setting">
          <input
            type="checkbox"
            checked={draftEvent.allowMixed}
            onChange={(e) =>
              setDraftEvent({ ...draftEvent, allowMixed: e.target.checked })
            }
          />
          Allow tickets from multiple categories in one booking
        </label>
        <details className="venue-layout-editor">
          <summary>
            Venue Layout & Seat Quantities <span>+</span>
          </summary>
          <p className="seating-demo-note">
            Changes to section positions and capacity apply to every concert at{" "}
            {venue.name}. Sold or reserved seat IDs cannot be removed.
          </p>
          <div className="section-config-toolbar">
            <label>
              Section
              <select
                aria-label="Edit venue section"
                value={selected.id}
                onChange={(e) => setSectionId(e.target.value)}
              >
                {draftVenue.sections.map((s) => (
                  <option value={s.id} key={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="button secondary compact"
              onClick={() => {
                const id = `section-${crypto.randomUUID().slice(0, 8)}`;
                setDraftVenue({
                  ...draftVenue,
                  sections: [
                    ...draftVenue.sections,
                    {
                      id,
                      name: "New Section",
                      categoryId: draftVenue.categories[0].id,
                      x: 4,
                      y: 87,
                      width: 20,
                      height: 9,
                      mode: "numbered",
                      rows: 2,
                      seatsPerRow: 6,
                      capacity: 12,
                      accessible: [],
                    },
                  ],
                });
                setSectionId(id);
              }}
            >
              Add Section
            </button>
          </div>
          <div className="section-config-fields">
            <label>
              Section name
              <input
                aria-label="Section name"
                value={selected.name}
                required
                onChange={(e) => updateSection("name", e.target.value)}
              />
            </label>
            <label>
              Category
              <select
                aria-label="Section category"
                value={selected.categoryId}
                onChange={(e) => updateSection("categoryId", e.target.value)}
              >
                {draftVenue.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Seating type
              <select
                aria-label="Seating type"
                value={selected.mode}
                onChange={(e) => updateSection("mode", e.target.value)}
              >
                <option value="numbered">Numbered seats</option>
                <option value="general">General admission</option>
              </select>
            </label>
            {selected.mode === "numbered" ? (
              <>
                <label>
                  Rows
                  <input
                    aria-label="Number of rows"
                    type="number"
                    min="1"
                    max="26"
                    value={selected.rows}
                    onChange={(e) =>
                      updateSection("rows", Number(e.target.value))
                    }
                  />
                </label>
                <label>
                  Seats per row
                  <input
                    aria-label="Seats per row"
                    type="number"
                    min="1"
                    max="30"
                    value={selected.seatsPerRow}
                    onChange={(e) =>
                      updateSection("seatsPerRow", Number(e.target.value))
                    }
                  />
                </label>
              </>
            ) : (
              <label>
                Capacity
                <input
                  aria-label="General admission capacity"
                  type="number"
                  min="1"
                  max="1000"
                  value={selected.capacity}
                  onChange={(e) =>
                    updateSection("capacity", Number(e.target.value))
                  }
                />
              </label>
            )}
            {[
              ["x", "Left (%)"],
              ["y", "Top (%)"],
              ["width", "Width (%)"],
              ["height", "Height (%)"],
            ].map(([field, label]) => (
              <label key={field}>
                {label}
                <input
                  type="number"
                  aria-label={label}
                  min="0"
                  max="100"
                  step="1"
                  value={selected[field as "x" | "y" | "width" | "height"]}
                  onChange={(e) => updateSection(field, Number(e.target.value))}
                />
              </label>
            ))}
            <label className="accessible-config">
              Accessible seats
              <input
                aria-label="Accessible seats"
                placeholder="A1, A2 or GA1"
                value={selected.accessible.join(", ")}
                onChange={(e) =>
                  updateSection(
                    "accessible",
                    e.target.value
                      .split(",")
                      .map((v) => v.trim().toUpperCase())
                      .filter(Boolean),
                  )
                }
              />
            </label>
          </div>
          <VenueMap
            snapshot={preview}
            eventId={event.eventId}
            bookings={showcase.inventory}
            now={now}
            selectedSection={selected.id}
            onSection={setSectionId}
          />
        </details>
        <button type="submit" className="button primary save-seating">
          Save Seating Configuration
        </button>
      </form>
      <div className="manager-inventory">
        <h3>Seat Availability</h3>
        <label>
          Section
          <select
            aria-label="Manage inventory section"
            value={actualSection.id}
            onChange={(e) => setSectionId(e.target.value)}
          >
            {venue.sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <SectionSeats
          snapshot={snapshot}
          eventId={event.eventId}
          section={actualSection}
          bookings={showcase.inventory}
          now={now}
          manage
          onSeat={async (seat, status) => {
            try {
              await demoApi("organizer/block", {
                eventId: event.eventId,
                seatId: seat.id,
                blocked: status !== "blocked",
              });
              setSeatBlocked(
                event.eventId,
                seat.id,
                status !== "blocked",
                showcase.inventory,
              );
              setMessage({
                text: status === "blocked" ? "Seat released." : "Seat blocked.",
                ok: true,
              });
            } catch (e) {
              setMessage({
                text: e instanceof Error ? e.message : "Unable to update seat.",
                ok: false,
              });
            }
          }}
        />
      </div>
    </>
  );
}
