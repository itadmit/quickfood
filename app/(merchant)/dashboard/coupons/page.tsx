import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { CouponsView } from "./CouponsView";

export const dynamic = "force-dynamic";

export default async function CouponsPage() {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }

  const [coupons, categories] = await Promise.all([
    prisma.coupon.findMany({
      where: { tenantId: session.tenantId },
      orderBy: [{ active: "desc" }, { validFrom: "desc" }],
    }),
    prisma.menuCategory.findMany({
      where: { tenantId: session.tenantId, active: true },
      orderBy: { position: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <CouponsView
      initial={coupons.map((c) => ({
        id: c.id,
        code: c.code,
        description: c.description,
        type: c.type as "percent" | "fixed",
        value: c.value,
        minOrder: c.minOrder,
        maxDiscount: c.maxDiscount,
        usageLimit: c.usageLimit,
        usageCount: c.usageCount,
        perCustomerLimit: c.perCustomerLimit,
        validFrom: c.validFrom.toISOString(),
        validUntil: c.validUntil?.toISOString() ?? null,
        active: c.active,
        appliesTo: c.appliesTo as "all" | "category" | "items",
        categoryId: c.categoryId,
        itemIds: c.itemIds,
      }))}
      categories={categories}
    />
  );
}
