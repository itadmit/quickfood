import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { SettingsHeader } from "../SettingsHeader";
import { CheckoutSettingsForm } from "./CheckoutSettingsForm";

export const dynamic = "force-dynamic";

export default async function CheckoutSettingsPage() {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: {
      checkoutShowTracking: true,
      scheduledOrdersEnabled: true,
      pickupEnabled: true,
      cutleryEnabled: true,
      cutleryLabel: true,
      cutleryPrice: true,
      cutleryFreeAbove: true,
      tipEnabled: true,
    },
  });
  if (!tenant) redirect("/dashboard/login");

  return (
    <div className="space-y-5">
      <SettingsHeader subtitle="מה הלקוח רואה ויכול לעשות במסך הקופה" />
      <CheckoutSettingsForm
        initial={{
          showTracking: tenant.checkoutShowTracking,
          scheduledOrdersEnabled: tenant.scheduledOrdersEnabled,
          pickupEnabled: tenant.pickupEnabled,
          cutleryEnabled: tenant.cutleryEnabled,
          cutleryLabel: tenant.cutleryLabel,
          cutleryPrice: tenant.cutleryPrice,
          cutleryFreeAbove: tenant.cutleryFreeAbove,
          tipEnabled: tenant.tipEnabled,
        }}
      />
    </div>
  );
}
