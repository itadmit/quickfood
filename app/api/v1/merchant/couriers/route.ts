import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CourierInput = z.object({
  name: z.string().min(1).max(80),
  phone: z.string().min(7).max(20),
  vehicle: z.enum(["scooter", "bike", "car", "walking"]).default("scooter"),
  branch_id: z.string().uuid().optional(),
});

export const GET = handler(async () => {
  const session = await requireMerchant();
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const couriers = await prisma.courier.findMany({
    where: { tenantId: session.tenantId },
    orderBy: { createdAt: "desc" },
  });
  return apiJson({
    couriers: couriers.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      vehicle: c.vehicle,
      status: c.status,
      current_order_id: c.currentOrderId,
      rating_avg: Number(c.ratingAvg),
      deliveries_today: c.deliveriesToday,
      created_at: c.createdAt.toISOString(),
    })),
  });
});

export const POST = handler(async (req: Request) => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const body = CourierInput.parse(await req.json());

  let branchId = body.branch_id;
  if (!branchId) {
    const primary = await prisma.branch.findFirst({
      where: { tenantId: session.tenantId, isPrimary: true },
      select: { id: true },
    });
    branchId = primary?.id;
  }

  const courier = await prisma.courier.create({
    data: {
      tenantId: session.tenantId,
      branchId: branchId ?? null,
      name: body.name,
      phone: body.phone,
      vehicle: body.vehicle,
      status: "offline",
    },
  });
  return apiJson({ courier: { id: courier.id, name: courier.name, status: courier.status } }, 201);
});
