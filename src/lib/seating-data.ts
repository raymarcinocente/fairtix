import { concerts } from "./concerts";

export type Category = { id: string; name: string; color: string };
export type VenueSection = {
  id: string;
  name: string;
  categoryId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  mode: "numbered" | "general";
  rows: number;
  seatsPerRow: number;
  capacity: number;
  accessible: string[];
};
export type VenueLayout = {
  id: string;
  name: string;
  categories: Category[];
  sections: VenueSection[];
};
export type EventSeating = {
  eventId: string;
  venueId: string;
  prices: Record<string, number>;
  allowMixed: boolean;
  overrides: Record<string, "blocked" | "available">;
};
export type Seat = {
  id: string;
  sectionId: string;
  row: string | null;
  number: number;
  accessible: boolean;
};
export type SeatTicket = Seat & {
  sectionName: string;
  categoryId: string;
  categoryName: string;
  color: string;
  price: number;
};
export type SeatStatus = "available" | "selected" | "held" | "sold" | "blocked";
export const categoryDefaults: Category[] = [
  { id: "vvip", name: "VVIP", color: "#FFCC30" },
  { id: "vip", name: "VIP", color: "#B581FF" },
  { id: "gold", name: "Gold", color: "#6EB4E5" },
  { id: "silver", name: "Silver", color: "#77C9A5" },
  { id: "ga", name: "General Admission", color: "#F29CC3" },
];
function section(
  id: string,
  name: string,
  categoryId: string,
  x: number,
  y: number,
  width: number,
  height: number,
  rows: number,
  seatsPerRow: number,
): VenueSection {
  return {
    id,
    name,
    categoryId,
    x,
    y,
    width,
    height,
    mode: categoryId === "ga" ? "general" : "numbered",
    rows,
    seatsPerRow,
    capacity: rows * seatsPerRow,
    accessible: categoryId === "silver" ? ["A1", "A2"] : [],
  };
}
export const venueDefaults: VenueLayout[] = [
  {
    id: "harbor",
    name: "Harbor Stage",
    categories: categoryDefaults,
    sections: [
      section("vvip-front", "VVIP Front", "vvip", 34, 19, 32, 13, 2, 8),
      section("vip-left", "VIP Left", "vip", 7, 25, 22, 25, 3, 8),
      section("vip-right", "VIP Right", "vip", 71, 25, 22, 25, 3, 8),
      section("gold-center", "Gold Center", "gold", 34, 37, 32, 20, 4, 8),
      section("silver-left", "Silver Left", "silver", 7, 57, 22, 24, 3, 8),
      section("silver-right", "Silver Right", "silver", 71, 57, 22, 24, 3, 8),
      section("ga-rear", "General Admission Rear", "ga", 34, 65, 32, 24, 5, 10),
    ],
  },
  {
    id: "garden",
    name: "The Garden",
    categories: categoryDefaults,
    sections: [
      section("vvip-front", "VVIP Front", "vvip", 29, 20, 42, 12, 2, 6),
      section("vip-left", "VIP West", "vip", 8, 37, 39, 16, 2, 7),
      section("vip-right", "VIP East", "vip", 53, 37, 39, 16, 2, 7),
      section("gold-center", "Gold Terrace", "gold", 20, 59, 60, 13, 3, 8),
      section("silver-left", "Silver Lawn", "silver", 8, 78, 39, 15, 2, 8),
      section("ga-rear", "General Admission Lawn", "ga", 53, 78, 39, 15, 3, 10),
    ],
  },
  {
    id: "warehouse",
    name: "The Warehouse",
    categories: categoryDefaults,
    sections: [
      section("vvip-front", "VVIP Floor", "vvip", 30, 20, 40, 12, 2, 8),
      section("vip-left", "VIP Left", "vip", 7, 38, 40, 18, 3, 6),
      section("vip-right", "VIP Right", "vip", 53, 38, 40, 18, 3, 6),
      section("gold-center", "Gold Floor", "gold", 30, 62, 40, 12, 3, 8),
      section("silver-left", "Silver Balcony", "silver", 7, 62, 17, 30, 4, 4),
      section(
        "ga-rear",
        "General Admission Floor",
        "ga",
        30,
        80,
        63,
        13,
        4,
        10,
      ),
    ],
  },
  {
    id: "riverfront",
    name: "Riverfront Arena",
    categories: categoryDefaults,
    sections: [
      section("vvip-front", "VVIP Floor", "vvip", 35, 18, 30, 17, 3, 8),
      section("vip-left", "VIP West", "vip", 10, 23, 19, 33, 4, 8),
      section("vip-right", "VIP East", "vip", 71, 23, 19, 33, 4, 8),
      section("gold-center", "Gold Floor", "gold", 35, 42, 30, 20, 5, 8),
      section("silver-left", "Silver West", "silver", 10, 64, 19, 26, 4, 8),
      section("silver-right", "Silver East", "silver", 71, 64, 19, 26, 4, 8),
      section(
        "ga-rear",
        "General Admission Upper",
        "ga",
        35,
        70,
        30,
        20,
        8,
        10,
      ),
    ],
  },
  {
    id: "coastal",
    name: "Coastal Grounds",
    categories: categoryDefaults,
    sections: [
      section("vvip-front", "VVIP Deck", "vvip", 30, 20, 40, 13, 3, 6),
      section("vip-left", "VIP West", "vip", 8, 39, 38, 17, 3, 8),
      section("vip-right", "VIP East", "vip", 54, 39, 38, 17, 3, 8),
      section("gold-center", "Gold Deck", "gold", 30, 62, 40, 12, 4, 8),
      section("silver-left", "Silver Field", "silver", 8, 62, 17, 30, 4, 5),
      section(
        "ga-rear",
        "General Admission Field",
        "ga",
        30,
        80,
        62,
        13,
        10,
        10,
      ),
    ],
  },
];
// Event prices are explicit demo configuration, independent of the shared venue geometry.
const eventDefinitions: [string, string, number[], boolean][] = [
  ["neon-nights", "harbor", [250, 170, 115, 75, 45], true],
  ["golden-hour", "garden", [140, 95, 60, 40, 25], true],
  ["wild-hearts", "warehouse", [190, 130, 90, 55, 35], true],
  ["beyond-the-noise", "riverfront", [280, 195, 130, 85, 50], false],
  ["pulse-festival", "coastal", [350, 240, 160, 105, 65], true],
  ["midnight-echoes", "harbor", [220, 150, 100, 65, 40], true],
];
export const eventSeatingDefaults: EventSeating[] = eventDefinitions.map(
  ([eventId, venueId, prices, allowMixed]) => ({
    eventId,
    venueId,
    prices: Object.fromEntries(
      categoryDefaults.map((c, i) => [c.id, prices[i]]),
    ),
    allowMixed,
    overrides: {},
  }),
);
export function sectionSeats(section: VenueSection): Seat[] {
  return Array.from(
    {
      length: Math.max(
        0,
        Math.min(
          1000,
          section.mode === "general"
            ? section.capacity
            : section.rows * section.seatsPerRow,
        ),
      ),
    },
    (_, i) => {
      const row =
        section.mode === "general"
          ? null
          : String.fromCharCode(65 + Math.floor(i / section.seatsPerRow));
      const number =
        section.mode === "general" ? i + 1 : (i % section.seatsPerRow) + 1;
      return {
        id: `${section.id}/${row || "GA"}/${number}`,
        sectionId: section.id,
        row,
        number,
        accessible: section.accessible.includes(`${row || "GA"}${number}`),
      };
    },
  );
}
export function legacySeatId(id: string) {
  if (id.includes("/")) return id;
  const match = id.match(/^(VIP|Premium|Regular|General)-([A-Z])(\d+)$/);
  if (!match) return id;
  const sectionId = (
    {
      VIP: "vvip-front",
      Premium: "vip-left",
      Regular: "gold-center",
      General: "ga-rear",
    } as Record<string, string>
  )[match[1]];
  return `${sectionId}/${match[1] === "General" ? "GA" : match[2]}/${match[1] === "General" ? (match[2].charCodeAt(0) - 65) * 10 + Number(match[3]) : match[3]}`;
}
export function configuredPrices(event: EventSeating, venue: VenueLayout) {
  return venue.sections
    .filter(
      (section) =>
        sectionSeats(section).length > 0 &&
        Number.isFinite(event.prices[section.categoryId]),
    )
    .map((section) => event.prices[section.categoryId]);
}
export function seatLabel(
  seat: Pick<SeatTicket, "sectionName" | "row" | "number">,
) {
  return `${seat.sectionName} · ${seat.row ? `Row ${seat.row} · Seat ${seat.number}` : "General admission"}`;
}
export function concertName(eventId: string) {
  const c = concerts.find((v) => v.id === eventId);
  return c ? `${c.artist} ${c.title}` : eventId;
}
export function seededStatus(
  eventId: string,
  seat: Seat,
): "available" | "sold" | "held" | "blocked" {
  // Fixed mock inventory, not a randomly changing render-time calculation.
  const variation = eventDefinitions.findIndex((v) => v[0] === eventId);
  if (seat.row === "A" && seat.number === 3) return "sold";
  if (seat.row === "A" && seat.number === 4) return "held";
  if (seat.row === "B" && seat.number === 2) return "blocked";
  if (seat.row === "C" && seat.number === 5 + (variation % 2)) return "sold";
  return "available";
}
