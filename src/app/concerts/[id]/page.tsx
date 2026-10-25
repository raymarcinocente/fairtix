import { notFound } from "next/navigation";
import FairTix from "@/components/fairtix";
import { concerts } from "@/lib/concerts";
export function generateStaticParams() {
  return concerts.filter((c) => c.id !== "event-1").map((c) => ({ id: c.id }));
}
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!concerts.some((c) => c.id === id && c.id !== "event-1")) notFound();
  return <FairTix view="concert" concertId={id} />;
}
