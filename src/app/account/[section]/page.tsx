import { notFound } from "next/navigation";
import FairTix from "@/components/fairtix";
import { requireUser } from "@/lib/mock-account-server";
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!["profile", "security", "wallet", "transactions"].includes(section))
    notFound();
  await requireUser(`/account/${section}`);
  return <FairTix view="account" accountSection={section} />;
}
