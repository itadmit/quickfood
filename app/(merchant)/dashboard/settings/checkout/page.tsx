import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { SettingsTabs } from "../SettingsTabs";
import { CheckoutSettingsForm } from "./CheckoutSettingsForm";

export const dynamic = "force-dynamic";

export default async function CheckoutSettingsPage() {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: { checkoutShowTracking: true, scheduledOrdersEnabled: true },
  });
  if (!tenant) redirect("/dashboard/login");

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">הגדרות</h1>
        <p className="text-sm text-qf-mute">
          מה הלקוח רואה ויכול לעשות במסך הקופה
        </p>
      </header>
      <SettingsTabs />
      <CheckoutSettingsForm
        initial={{
          showTracking: tenant.checkoutShowTracking,
          scheduledOrdersEnabled: tenant.scheduledOrdersEnabled,
        }}
      />
    </div>
  );
}
