import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { FreeGiftsView } from "./FreeGiftsView";

export const dynamic = "force-dynamic";

export default async function FreeGiftsPage() {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }

  const [rules, items] = await Promise.all([
    prisma.freeGiftRule.findMany({
      where: { tenantId: session.tenantId },
      orderBy: [{ minSubtotal: "asc" }, { createdAt: "asc" }],
      include: { item: { select: { name: true, available: true } } },
    }),
    prisma.menuItem.findMany({
      where: { tenantId: session.tenantId, available: true },
      orderBy: [{ position: "asc" }],
      select: { id: true, name: true, basePrice: true },
    }),
  ]);

  return (
    <FreeGiftsView
      initial={rules.map((r) => ({
        id: r.id,
        itemId: r.itemId,
        itemName: r.item.name,
        itemAvailable: r.item.available,
        minSubtotal: r.minSubtotal,
        active: r.active,
        validFrom: r.validFrom?.toISOString() ?? null,
        validUntil: r.validUntil?.toISOString() ?? null,
      }))}
      items={items}
    />
  );
}
