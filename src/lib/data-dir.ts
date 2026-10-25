import path from "node:path";

// Local file storage root. Vercel's deployment filesystem is read-only, so
// there we fall back to /tmp: writable, but per-instance and wiped on cold
// starts and redeploys. Demo use only; swap for a real database before launch.
export const DATA_DIR = process.env.VERCEL
  ? path.join("/tmp", "fairtix-data")
  : path.join(process.cwd(), ".data");
