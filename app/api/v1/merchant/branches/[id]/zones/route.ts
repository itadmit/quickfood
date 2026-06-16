import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { DeliveryZoneInputSchema } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const session = await requireMerchant();
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const { id } = await params;
  const branch = await prisma.branch.findUnique({ where: { id }, select: { tenantId: true } });
  if (!branch || branch.tenantId !== session.tenantId) {
    return apiError("forbidden", "אין הרשאה", 403);
  }
  const zones = await prisma.deliveryZone.findMany({ where: { branchId: id } });
  return apiJson({
    zones: zones.map((z) => ({
      id: z.id,
      name: z.name,
      radius_km: z.radiusKm ? Number(z.radiusKm) : null,
      cities: z.cities,
      delivery_fee: z.deliveryFee,
      min_order: z.minOrder,
      free_delivery_above: z.freeDeliveryAbove,
      min_eta: z.minEta,
      max_eta: z.maxEta,
      active: z.active,
    })),
  });
});

export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const { id } = await params;
  const body = DeliveryZoneInputSchema.parse(await req.json());
  const branch = await prisma.branch.findUnique({ where: { id }, select: { tenantId: true } });
  if (!branch || branch.tenantId !== session.tenantId) {
    return apiError("forbidden", "אין הרשאה", 403);
  }
  const zone = await prisma.deliveryZone.create({
    data: {
      branchId: id,
      name: body.name,
      radiusKm: body.radius_km,
      cities: normalizeCities(body.cities),
      deliveryFee: body.delivery_fee,
      minOrder: body.min_order,
      freeDeliveryAbove: body.free_delivery_above ?? null,
      minEta: body.min_eta,
      maxEta: body.max_eta,
      active: body.active,
    },
  });
  return apiJson({ zone: { id: zone.id, name: zone.name } }, 201);
});

/** Trim, drop blanks, dedupe (case-insensitive). */
function normalizeCities(input: string[] | undefined): string[] {
  if (!input || input.length === 0) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    const v = raw.trim().replace(/\s+/g, " ");
    if (!v) continue;
    const key = v.toLocaleLowerCase("he-IL");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}
