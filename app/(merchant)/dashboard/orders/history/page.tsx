import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { OrdersHistoryView } from "./OrdersHistoryView";

export const dynamic = "force-dynamic";

export default async function OrdersHistoryPage() {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }
  return <OrdersHistoryView />;
}
