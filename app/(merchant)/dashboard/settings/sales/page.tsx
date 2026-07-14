import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { SettingsHeader } from "../SettingsHeader";
import { SalesSettingsForm } from "./SalesSettingsForm";

export const dynamic = "force-dynamic";

export default async function SalesSettingsPage() {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: {
      featuredBadgeLabel: true,
      upsellSizeNudge: true,
      cartUpsellTitle: true,
    },
  });
  if (!tenant) redirect("/dashboard/login");

  return (
    <div className="space-y-5">
      <SettingsHeader subtitle="כלי מכירות והגדרות אפסיילים" />
      <SalesSettingsForm
        initial={{
          featuredBadgeLabel: tenant.featuredBadgeLabel ?? "",
          upsellSizeNudge: tenant.upsellSizeNudge,
          cartUpsellTitle: tenant.cartUpsellTitle ?? "",
        }}
      />
    </div>
  );
}
