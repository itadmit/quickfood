import { redirect } from "next/navigation";
import { getCourierSession } from "@/lib/auth/courier-session";
import { CourierOrderDetail } from "./CourierOrderDetail";

export const dynamic = "force-dynamic";

export default async function CourierOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getCourierSession();
  if (!session) redirect("/courier/login");
  const { id } = await params;
  return <CourierOrderDetail orderId={id} />;
}
