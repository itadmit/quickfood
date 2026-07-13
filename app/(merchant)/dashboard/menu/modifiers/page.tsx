import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { ModifiersManager } from "./ModifiersManager";

export const dynamic = "force-dynamic";

export default async function ModifiersPage() {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }

  const sets = await prisma.modifierSet.findMany({
    where: { tenantId: session.tenantId },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    include: {
      options: { orderBy: { position: "asc" } },
      _count: { select: { attachedTo: true } },
    },
  });

  return (
    <ModifiersManager
      initialSets={sets.map((s) => ({
        id: s.id,
        name: s.name,
        type: s.type as "single" | "multi",
        required: s.required,
        minSelect: s.minSelect,
        maxSelect: s.maxSelect,
        includedFree: s.includedFree,
        helpText: s.helpText,
        allowHalf: s.allowHalf,
        allowQty: s.allowQty,
        splitPrice: s.splitPrice,
        customHalfPrice: s.customHalfPrice,
        bundleCount: s.bundleCount,
        bundlePrice: s.bundlePrice,
        maxPerSide: s.maxPerSide,
        position: s.position,
        attachedCount: s._count.attachedTo,
        options: s.options.map((o) => ({
          name: o.name,
          priceDelta: o.priceDelta,
          halfPriceDelta: o.halfPriceDelta,
          isDefault: o.isDefault,
          available: o.available,
          imageUrl: o.imageUrl,
        })),
      }))}
    />
  );
}
