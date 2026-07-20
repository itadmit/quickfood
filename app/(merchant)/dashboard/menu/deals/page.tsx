import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { DEAL_INCLUDE, serializeDeal } from "@/lib/deals";
import { DealsManager } from "./DealsManager";

export const dynamic = "force-dynamic";

export default async function DealsPage() {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }

  const [deals, items, categories] = await Promise.all([
    prisma.deal.findMany({
      where: { tenantId: session.tenantId },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      include: DEAL_INCLUDE,
    }),
    prisma.menuItem.findMany({
      where: { tenantId: session.tenantId },
      orderBy: [{ categoryId: "asc" }, { position: "asc" }],
      select: {
        id: true,
        name: true,
        basePrice: true,
        categoryId: true,
        available: true,
        images: true,
        sizes: {
          orderBy: { position: "asc" },
          select: { id: true, name: true, priceDelta: true, isDefault: true },
        },
      },
    }),
    prisma.menuCategory.findMany({
      where: { tenantId: session.tenantId, active: true },
      orderBy: { position: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <DealsManager
      initialDeals={deals.map(serializeDeal)}
      menuItems={items.map((i) => ({
        id: i.id,
        name: i.name,
        basePrice: i.basePrice,
        categoryId: i.categoryId,
        available: i.available,
        image: i.images[0] ?? null,
        sizes: i.sizes,
      }))}
      categories={categories}
    />
  );
}
