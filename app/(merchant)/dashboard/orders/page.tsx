import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { fullName } from "@/lib/format";
import { OrdersKanban } from "./OrdersKanban";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }

  const orders = await prisma.order.findMany({
    where: {
      tenantId: session.tenantId,
      status: {
        in: ["pending", "confirmed", "preparing", "in_oven", "ready", "out_for_delivery"],
      },
    },
    include: {
      items: { select: { id: true, nameSnapshot: true, quantity: true, sizeSnapshot: true } },
      customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
    },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  const initial = orders.map((o) => ({
    id: o.id,
    number: o.number,
    status: o.status as KanbanStatus,
    method: o.method,
    customerName:
      fullName(o.customer?.firstName, o.customer?.lastName) ||
      fullName(o.customerFirstNameSnap, o.customerLastNameSnap) ||
      "אורח",
    customerPhone: o.customer?.phone || o.customerPhoneSnap || "",
    customerNotes: o.customerNotes,
    paymentStatus: o.paymentStatus as "pending" | "paid" | "failed" | "refunded",
    paymentMethod: o.paymentMethod,
    total: o.total,
    createdAt: o.createdAt.toISOString(),
    items: o.items.map((it) => ({
      id: it.id,
      name: it.nameSnapshot,
      quantity: it.quantity,
      size: it.sizeSnapshot,
    })),
  }));

  return <OrdersKanban initial={initial} />;
}

export type KanbanStatus = "pending" | "confirmed" | "preparing" | "in_oven" | "ready" | "out_for_delivery";
