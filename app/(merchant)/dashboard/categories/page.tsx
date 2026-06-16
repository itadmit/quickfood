import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { CategoriesView } from "./CategoriesView";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }

  const [categories, itemCounts, tenant] = await Promise.all([
    prisma.menuCategory.findMany({
      where: { tenantId: session.tenantId },
      orderBy: { position: "asc" },
    }),
    prisma.menuItem.groupBy({
      by: ["categoryId"],
      where: { tenantId: session.tenantId },
      _count: { _all: true },
    }),
    prisma.tenant.findUnique({
      where: { id: session.tenantId },
      select: { themeId: true },
    }),
  ]);

  const counts = Object.fromEntries(
    itemCounts.map((c) => [c.categoryId, c._count._all]),
  );

  return (
    <CategoriesView
      themeId={tenant?.themeId}
      categories={categories.map((c) => ({
        id: c.id,
        name: c.name,
        icon: c.icon,
        color: c.color,
        position: c.position,
        upsellInCart: c.upsellInCart,
        upsellBeforeCheckout: c.upsellBeforeCheckout,
        itemCount: counts[c.id] ?? 0,
      }))}
    />
  );
}
