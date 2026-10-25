import { eventSeatingDefaults, venueDefaults, sectionSeats } from "./seating-data";
import type { ResaleListing } from "./resale-types";

// The same five prototype tickets seeded by the server. Render these while
// inventory loads; server inventory and purchase validation remain authoritative.
export const resaleExamples = [
  ["neon-nights", "vvip"],
  ["golden-hour", "vip"],
  ["wild-hearts", "gold"],
  ["beyond-the-noise", "silver"],
  ["pulse-festival", "ga"],
];

export const resalePreview: ResaleListing[] = resaleExamples.map(([eventId, categoryId]) => {
  const event = eventSeatingDefaults.find((event) => event.eventId === eventId)!;
  const venue = venueDefaults.find((venue) => venue.id === event.venueId)!;
  const section = venue.sections.find((section) => section.categoryId === categoryId)!;
  const category = venue.categories.find((category) => category.id === categoryId)!;
  const seats = sectionSeats(section);
  const seat = seats.find((seat) => seat.row === "B" && seat.number === 1) || seats[0];
  const faceValue = event.prices[categoryId];
  return {
    id: `resale-${eventId}`,
    eventId,
    price: Math.round(faceValue * 0.95 * 100) / 100,
    faceValue,
    ticket: {
      ...seat,
      sectionName: section.name,
      categoryId,
      categoryName: category.name,
      color: category.color,
      price: faceValue,
    },
    reservedUntil: null,
    reservedByMe: false,
  };
});
