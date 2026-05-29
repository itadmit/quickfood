import { redirect } from "next/navigation";
import { getCourierSession } from "@/lib/auth/courier-session";
import { CourierHistory } from "./CourierHistory";

export const dynamic = "force-dynamic";

export default async function CourierHistoryPage() {
  const session = await getCourierSession();
  if (!session) redirect("/courier/login");
  return <CourierHistory />;
}
