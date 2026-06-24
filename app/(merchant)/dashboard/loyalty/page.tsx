import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { loadLoyaltyData } from "@/lib/loyalty/members";
import { LoyaltyView } from "./LoyaltyView";

export const dynamic = "force-dynamic";

export default async function LoyaltyPage() {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: { name: true },
  });
  const { config, rows, stats } = await loadLoyaltyData(
    session.tenantId,
    tenant?.name ?? "העסק",
  );

  return <LoyaltyView initialConfig={config} rows={rows} stats={stats} />;
}
