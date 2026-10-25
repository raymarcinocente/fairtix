import { notFound, redirect } from "next/navigation";
import FairTix from "@/components/fairtix";
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!["profile", "security", "wallet", "transactions"].includes(section))
    notFound();
  if (["profile", "security"].includes(section)) redirect("/account");
  return <FairTix view="account" accountSection={section} />;
}
