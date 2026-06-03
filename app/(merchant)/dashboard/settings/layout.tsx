import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { canAccessDashboard, roleHome } from "@/lib/auth/merchant-access";

/**
 * Settings is owner/manager territory. Kitchen + courier roles are bounced
 * to their own home before any settings sub-page renders. (Billing, team,
 * and advanced keep their own finer owner-only guards.)
 */
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }
  if (!canAccessDashboard(session.role, "/dashboard/settings")) {
    redirect(roleHome(session.role));
  }
  return <>{children}</>;
}
