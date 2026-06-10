import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { SettingsHeader } from "../SettingsHeader";
import { ZonesView } from "./ZonesView";

export const dynamic = "force-dynamic";

export default async function ZonesSettingsPage() {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }
  const branch = await prisma.branch.findFirst({
    where: { tenantId: session.tenantId, isPrimary: true },
    include: { zones: { orderBy: { name: "asc" } } },
  });
  if (!branch) redirect("/dashboard/login");

  return (
    <div className="space-y-5">
      <SettingsHeader subtitle={`לאן מגיע המשלוח · ${branch.name}`} />
      <ZonesView
        branchId={branch.id}
        freeDelivery={{
          minOrder: branch.freeDeliveryMinOrder,
          minItems: branch.freeDeliveryMinItems,
        }}
        initial={branch.zones.map((z) => ({
          id: z.id,
          name: z.name,
          radiusKm: z.radiusKm ? Number(z.radiusKm) : null,
          cities: z.cities,
          deliveryFee: z.deliveryFee,
          minEta: z.minEta,
          maxEta: z.maxEta,
          active: z.active,
        }))}
      />
    </div>
  );
}
