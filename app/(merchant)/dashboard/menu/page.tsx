import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { MenuList } from "./MenuList";

export const dynamic = "force-dynamic";

export default async function MenuPage() {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }

  const [categories, items] = await Promise.all([
    prisma.menuCategory.findMany({
      where: { tenantId: session.tenantId },
      orderBy: { position: "asc" },
    }),
    prisma.menuItem.findMany({
      where: { tenantId: session.tenantId },
      orderBy: [{ categoryId: "asc" }, { position: "asc" }],
    }),
  ]);

  const visibleCount = items.filter((i) => i.available).length;
  const hiddenCount = items.length - visibleCount;

  return (
    <MenuList
      categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      items={items.map((i) => ({
        id: i.id,
        name: i.name,
        description: i.description,
        categoryId: i.categoryId,
        basePrice: i.basePrice,
        prepMinutes: i.prepMinutes,
        available: i.available,
        artType: i.artType,
        sku: i.sku,
      }))}
      visibleCount={visibleCount}
      hiddenCount={hiddenCount}
    />
  );
}
