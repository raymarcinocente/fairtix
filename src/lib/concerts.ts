export type Concert = {
  id: string;
  artist: string;
  title: string;
  subtitle: string;
  image: string;
  date: string;
  venue: string;
  city: string;
  genre: string;
  price: number;
  accent: string;
  status: "on-sale" | "presale" | "upcoming";
  label: string;
};
// Fictional showcase records; the original FairTix event retains its ID and XLM workflow.
export const concerts: Concert[] = [
  {
    id: "event-1",
    artist: "ILOILO",
    title: "AFTER HOURS",
    subtitle: "",
    image: "after-hours",
    date: "Date to be announced",
    venue: "Venue to be announced",
    city: "Iloilo City",
    genre: "Live music",
    price: 1,
    accent: "#ffcc30",
    status: "on-sale",
    label: "",
  },
  {
    id: "neon-nights",
    artist: "NEON",
    title: "NIGHTS",
    subtitle: "",
    image: "electric",
    date: "Nov 21, 2026 · 8:00 PM",
    venue: "Harbor Stage",
    city: "Manila",
    genre: "Electronic",
    price: 45,
    accent: "#bb8aff",
    status: "on-sale",
    label: "",
  },
  {
    id: "golden-hour",
    artist: "THE",
    title: "GOLDEN HOUR",
    subtitle: "",
    image: "singer",
    date: "Dec 05, 2026 · 6:00 PM",
    venue: "The Garden",
    city: "Iloilo City",
    genre: "Acoustic",
    price: 25,
    accent: "#eccc9d",
    status: "presale",
    label: "",
  },
  {
    id: "wild-hearts",
    artist: "WILD",
    title: "HEARTS",
    subtitle: "",
    image: "band",
    date: "Dec 12, 2026 · 7:00 PM",
    venue: "The Warehouse",
    city: "Cebu",
    genre: "Indie rock",
    price: 35,
    accent: "#ff8861",
    status: "on-sale",
    label: "",
  },
  {
    id: "beyond-the-noise",
    artist: "BEYOND",
    title: "THE NOISE",
    subtitle: "",
    image: "stage",
    date: "Jan 16, 2027 · 7:30 PM",
    venue: "Riverfront Arena",
    city: "Manila",
    genre: "Alternative",
    price: 50,
    accent: "#8edcc6",
    status: "upcoming",
    label: "",
  },
  {
    id: "pulse-festival",
    artist: "PULSE",
    title: "FESTIVAL",
    subtitle: "",
    image: "festival",
    date: "Feb 06, 2027 · 4:00 PM",
    venue: "Coastal Grounds",
    city: "Iloilo City",
    genre: "Festival",
    price: 65,
    accent: "#ec96d5",
    status: "presale",
    label: "",
  },
  {
    id: "midnight-echoes",
    artist: "MIDNIGHT",
    title: "ECHOES",
    subtitle: "",
    image: "crowd",
    date: "Jan 30, 2027 · 8:00 PM",
    venue: "Harbor Stage",
    city: "Manila",
    genre: "Pop",
    price: 40,
    accent: "#a0bbff",
    status: "on-sale",
    label: "",
  },
];
export function concertUrl(concert: Concert) {
  return concert.id === "event-1" ? "/event" : `/concerts/${concert.id}`;
}
export function concertPrice(concert: Concert) {
  return `${concert.price} ${concert.id === "event-1" ? "XLM" : "USDC"}`;
}
