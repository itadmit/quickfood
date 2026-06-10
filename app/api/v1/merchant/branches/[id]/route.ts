import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BranchPatch = z.object({
  name: z.string().min(1).max(80).optional(),
  address: z.string().min(1).max(200).optional(),
  phone: z.string().min(7).max(20).optional(),
  email: z.string().email().optional(),
  status: z.enum(["open", "busy", "closed"]).optional(),
  busy_eta_boost_minutes: z.number().int().min(0).max(180).optional(),
  hours: z.record(z.any()).optional(),
  min_order: z.number().int().min(0).optional(),
  delivery_fee: z.number().int().min(0).optional(),
  service_fee: z.number().int().min(0).optional(),
  free_delivery_min_order: z.number().int().min(0).nullable().optional(),
  free_delivery_min_items: z.number().int().min(0).nullable().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

export const PATCH = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const { id } = await params;
  const body = BranchPatch.parse(await req.json());

  const branch = await prisma.branch.findUnique({ where: { id }, select: { tenantId: true } });
  if (!branch) return apiError("not_found", "סניף לא נמצא", 404);
  if (branch.tenantId !== session.tenantId) return apiError("forbidden", "אין הרשאה", 403);

  const updated = await prisma.branch.update({
    where: { id },
    data: {
      name: body.name,
      address: body.address,
      phone: body.phone,
      email: body.email,
      status: body.status,
      busyEtaBoostMinutes: body.busy_eta_boost_minutes,
      hours: body.hours as object | undefined,
      minOrder: body.min_order,
      deliveryFee: body.delivery_fee,
      serviceFee: body.service_fee,
      ...(body.free_delivery_min_order !== undefined && {
        freeDeliveryMinOrder: body.free_delivery_min_order && body.free_delivery_min_order > 0
          ? body.free_delivery_min_order
          : null,
      }),
      ...(body.free_delivery_min_items !== undefined && {
        freeDeliveryMinItems: body.free_delivery_min_items && body.free_delivery_min_items > 0
          ? body.free_delivery_min_items
          : null,
      }),
      lat: body.lat as unknown as undefined,
      lng: body.lng as unknown as undefined,
    },
  });

  return apiJson({
    branch: {
      id: updated.id,
      name: updated.name,
      status: updated.status,
    },
  });
});
