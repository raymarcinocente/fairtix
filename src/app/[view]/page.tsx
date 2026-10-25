import { notFound, redirect } from "next/navigation";
import FairTix, { type View } from "@/components/fairtix";
const views = [
  "event",
  "tickets",
  "market",
  "scan",
  "guide",
  "concerts",
  "upcoming",
  "presale",
  "venues",
  "saved",
  "profile",
  "organizer",
  "login",
  "register",
  "forgot-password",
  "reset-password",
  "verify-email",
  "terms",
  "account",
] as const;
export function generateStaticParams() {
  return views.map((view) => ({ view }));
}
export default async function Page({
  params,
}: {
  params: Promise<{ view: string }>;
}) {
  const { view } = await params;
  if (!views.includes(view as (typeof views)[number])) notFound();
  if (
    [
      "login",
      "register",
      "forgot-password",
      "reset-password",
      "verify-email",
      "terms",
    ].includes(view)
  )
    redirect("/");
  return <FairTix view={view as View} />;
}
