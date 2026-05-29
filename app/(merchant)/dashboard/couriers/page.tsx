import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { CouriersView } from "./CouriersView";

export const dynamic = "force-dynamic";

export default async function CouriersPage() {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }

  const couriers = await prisma.courier.findMany({
    where: { tenantId: session.tenantId, active: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <CouriersView
      initial={couriers.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        hasLogin: !!c.pinHash,
        vehicle: c.vehicle,
        status: c.status,
        ratingAvg: Number(c.ratingAvg),
        deliveriesToday: c.deliveriesToday,
        cashOnHand: c.cashOnHand,
        tipsOnHand: c.tipsOnHand,
        tipsOwed: c.tipsOwed,
      }))}
    />
  );
}
