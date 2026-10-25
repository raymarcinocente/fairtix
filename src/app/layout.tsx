import type { Metadata } from "next";
import {
  Bricolage_Grotesque,
  IBM_Plex_Sans,
  IBM_Plex_Mono,
} from "next/font/google";
import "./globals.css";
import "./cinema.css";
import "./seating.css";
import "./account.css";
import AuthProvider from "@/components/auth-provider";

const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
});

const body = IBM_Plex_Sans({
  variable: "--font-body",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});
const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  weight: ["400", "500"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FairTix — Concerts & Events",
  description:
    "Browse concerts, select seats, and manage tickets in the FairTix demo.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${mono.variable}`}
    >
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
