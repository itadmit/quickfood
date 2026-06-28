import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getRepeatCustomers } from "@/lib/growth/customers";
import { RepeatCustomersView } from "./RepeatCustomersView";

export const dynamic = "force-dynamic";

export default async function RepeatCustomersPage() {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }
  const { segments, rows } = await getRepeatCustomers(session.tenantId);
  return <RepeatCustomersView segments={segments} rows={rows} />;
}
