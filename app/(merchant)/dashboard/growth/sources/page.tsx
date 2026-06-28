import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getSourcesForTenant } from "@/lib/growth/sources";
import { resolveGrowthSettings } from "@/lib/growth/settings";
import { SourcesView } from "./SourcesView";

export const dynamic = "force-dynamic";

export default async function GrowthSourcesPage() {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: { country: true, growthSettings: true },
  });
  const sources = await getSourcesForTenant(session.tenantId, tenant?.country ?? "IL");
  const settings = resolveGrowthSettings(tenant?.growthSettings);

  return (
    <SourcesView
      initialSources={sources.map((s) => ({
        sourceKey: s.sourceKey,
        sourceLabel: s.sourceLabel,
        sourceCategory: s.sourceCategory,
        isActive: s.isActive,
        sortOrder: s.sortOrder,
      }))}
      commissionRate={settings.commissionRate}
    />
  );
}
