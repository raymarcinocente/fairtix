import type { SeatTicket } from "./seating-data";
export type ResaleListing = {
  id: string;
  eventId: string;
  price: number;
  faceValue: number;
  ticket: SeatTicket;
  reservedUntil: number | null;
  reservedByMe: boolean;
};
export type StoredResaleListing = {
  id: string;
  bookingId: string;
  sellerId: string;
  eventId: string;
  price: number;
  faceValue: number;
  status: "listed" | "sold";
  reservedBy?: string;
  reservedUntil?: number;
};
