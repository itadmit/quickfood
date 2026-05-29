import { redirect } from "next/navigation";
import { getCourierSession } from "@/lib/auth/courier-session";
import { CourierHome } from "./CourierHome";

export const dynamic = "force-dynamic";

export default async function CourierHomePage() {
  const session = await getCourierSession();
  if (!session) redirect("/courier/login");
  return <CourierHome />;
}
