import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getRepeatCustomers, getRecentCampaigns } from "@/lib/growth/customers";
import { RepeatCustomersView } from "./RepeatCustomersView";

export const dynamic = "force-dynamic";

export default async function RepeatCustomersPage() {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }
  const [{ segments, rows }, campaigns] = await Promise.all([
    getRepeatCustomers(session.tenantId),
    getRecentCampaigns(session.tenantId),
  ]);
  return <RepeatCustomersView segments={segments} rows={rows} campaigns={campaigns} />;
}
