import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { KitchenDisplay } from "./KitchenDisplay";

export const dynamic = "force-dynamic";

const KITCHEN_STATUSES = ["pending", "confirmed", "preparing", "in_oven", "ready"] as const;

export default async function KitchenPage() {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }

  // Single server query for the initial paint. After that the page
  // lives on the existing /api/v1/realtime/merchant SSE feed (one
  // shared connection across the merchant's tabs) + a manual refresh
  // button. Zero polling, zero per-second DB hits.
  const orders = await prisma.order.findMany({
    where: {
      tenantId: session.tenantId,
      status: { in: [...KITCHEN_STATUSES] },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      number: true,
      status: true,
      method: true,
      customerNotes: true,
      createdAt: true,
      items: {
        select: {
          id: true,
          nameSnapshot: true,
          quantity: true,
          sizeSnapshot: true,
          selectedOptions: true,
          notes: true,
          preparedAt: true,
        },
        orderBy: { id: "asc" },
      },
    },
    take: 100,
  });

  return (
    <KitchenDisplay
      initial={orders.map((o) => ({
        id: o.id,
        number: o.number,
        // Query was filtered to KITCHEN_STATUSES so this narrowing is sound.
        status: o.status as "pending" | "confirmed" | "preparing" | "in_oven" | "ready",
        method: o.method,
        customerNotes: o.customerNotes,
        createdAt: o.createdAt.toISOString(),
        items: o.items.map((it) => {
          const raw = Array.isArray(it.selectedOptions)
            ? (it.selectedOptions as Array<Record<string, unknown>>)
            : [];
          const options = raw
            .filter((o) => typeof o?.name === "string")
            .map((o) => ({
              name: o.name as string,
              half: o.half as "left" | "right" | "full" | undefined,
            }));
          return {
            id: it.id,
            name: it.nameSnapshot,
            quantity: it.quantity,
            size: it.sizeSnapshot,
            notes: it.notes ?? null,
            preparedAt: it.preparedAt?.toISOString() ?? null,
            options,
          };
        }),
      }))}
    />
  );
}
