import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { BundlesView } from "./BundlesView";

export const dynamic = "force-dynamic";

export default async function BundlesPage() {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }

  const [bundles, items] = await Promise.all([
    prisma.bundleOffer.findMany({
      where: { tenantId: session.tenantId },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      include: {
        triggers: { include: { item: { select: { id: true, name: true } } } },
        addons: {
          include: { item: { select: { id: true, name: true, basePrice: true } } },
        },
        linkedItem: { select: { id: true, name: true, basePrice: true } },
      },
    }),
    prisma.menuItem.findMany({
      where: { tenantId: session.tenantId, available: true },
      orderBy: [{ position: "asc" }],
      select: { id: true, name: true, basePrice: true },
    }),
  ]);

  return (
    <BundlesView
      initial={bundles.map((b) => ({
        id: b.id,
        name: b.name,
        description: b.description,
        bundlePrice: b.bundlePrice,
        active: b.active,
        triggerItemIds: b.triggers.map((t) => t.itemId),
        linkedItemId: b.linkedItemId,
        linkedItemName: b.linkedItem?.name ?? null,
        linkedItemPrice: b.linkedItem?.basePrice ?? null,
        addonItems: b.addons.map((a) => ({ itemId: a.itemId, qty: a.qty })),
      }))}
      items={items}
    />
  );
}
