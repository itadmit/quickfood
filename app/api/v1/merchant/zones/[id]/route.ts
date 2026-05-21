import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { DeliveryZoneInputSchema } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function zoneBelongsToTenant(zoneId: string, tenantId: string) {
  const z = await prisma.deliveryZone.findUnique({
    where: { id: zoneId },
    select: { branch: { select: { tenantId: true } } },
  });
  return z?.branch.tenantId === tenantId;
}

export const PATCH = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const { id } = await params;
  if (!(await zoneBelongsToTenant(id, session.tenantId)))
    return apiError("forbidden", "אין הרשאה", 403);
  const body = DeliveryZoneInputSchema.partial().parse(await req.json());
  const updated = await prisma.deliveryZone.update({
    where: { id },
    data: {
      name: body.name,
      radiusKm: body.radius_km,
      ...(body.cities !== undefined && { cities: normalizeCities(body.cities) }),
      deliveryFee: body.delivery_fee,
      minEta: body.min_eta,
      maxEta: body.max_eta,
      active: body.active,
    },
  });
  return apiJson({ zone: { id: updated.id, active: updated.active } });
});

/** Trim, drop blanks, dedupe (case-insensitive). Keep in sync with the
 *  copy in /branches/[id]/zones/route.ts. */
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

export const DELETE = handler(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const { id } = await params;
  if (!(await zoneBelongsToTenant(id, session.tenantId)))
    return apiError("forbidden", "אין הרשאה", 403);
  await prisma.deliveryZone.delete({ where: { id } });
  return apiJson({ ok: true });
});
