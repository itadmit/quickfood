import { handler, apiJson } from "@/lib/api-response";
import { requireCourier } from "@/lib/auth/courier-session";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const session = await requireCourier();
  const c = await prisma.courier.findUnique({
    where: { id: session.courierId },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      vehicle: true,
      status: true,
      currentLat: true,
      currentLng: true,
      currentOrderId: true,
      maxConcurrent: true,
      cashOnHand: true,
      deliveriesToday: true,
      ratingAvg: true,
      tenant: { select: { id: true, name: true, logoUrl: true } },
    },
  });
  if (!c) return apiJson({ courier: null }, 404);
  return apiJson({
    courier: {
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      vehicle: c.vehicle,
      status: c.status,
      current_order_id: c.currentOrderId,
      current_lat: c.currentLat ? Number(c.currentLat) : null,
      current_lng: c.currentLng ? Number(c.currentLng) : null,
      max_concurrent: c.maxConcurrent,
      cash_on_hand: c.cashOnHand,
      deliveries_today: c.deliveriesToday,
      rating_avg: Number(c.ratingAvg),
      tenant: {
        id: c.tenant.id,
        name: c.tenant.name,
        logo_url: c.tenant.logoUrl,
      },
    },
  });
});
