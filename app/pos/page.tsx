import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { PosRegister } from "@/components/pos/PosRegister";

export const dynamic = "force-dynamic";

export default async function PosRegisterPage() {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }

  const [categories, items] = await Promise.all([
    prisma.menuCategory.findMany({
      where: { tenantId: session.tenantId, active: true },
      orderBy: { position: "asc" },
      select: { id: true, name: true, icon: true, color: true },
    }),
    prisma.menuItem.findMany({
      where: { tenantId: session.tenantId, available: true },
      orderBy: [{ categoryId: "asc" }, { position: "asc" }],
      select: {
        id: true,
        name: true,
        categoryId: true,
        basePrice: true,
        artType: true,
        images: true,
        sizes: {
          orderBy: { position: "asc" },
          select: { id: true, name: true, priceDelta: true, isDefault: true },
        },
        // Two flags drive picker behavior:
        // - hasOptions: any option group → open the config modal so the
        //   cashier can pick toppings (required or not).
        // - hasRequiredOptions: visual hint on the tile that this item
        //   has must-pick groups.
        _count: { select: { optionGroups: true } },
        optionGroups: { select: { id: true }, take: 1, where: { required: true } },
      },
    }),
  ]);

  return (
    <PosRegister
      categories={categories.map((c) => ({
        id: c.id,
        name: c.name,
        icon: c.icon,
        color: c.color,
      }))}
      items={items.map((i) => ({
        id: i.id,
        categoryId: i.categoryId,
        name: i.name,
        basePrice: i.basePrice,
        artType: i.artType,
        imageUrl: i.images?.[0] ?? null,
        defaultSize:
          i.sizes.find((s) => s.isDefault) ?? i.sizes[0] ?? null,
        sizeCount: i.sizes.length,
        hasOptions: i._count.optionGroups > 0,
        hasRequiredOptions: i.optionGroups.length > 0,
      }))}
    />
  );
}
