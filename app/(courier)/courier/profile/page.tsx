import { redirect } from "next/navigation";
import { getCourierSession } from "@/lib/auth/courier-session";
import { CourierProfile } from "./CourierProfile";

export const dynamic = "force-dynamic";

export default async function CourierProfilePage() {
  const session = await getCourierSession();
  if (!session) redirect("/courier/login");
  return <CourierProfile />;
}
