import { handler, apiJson, apiError } from "@/lib/api-response";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { resolveTenantBySlug } from "@/lib/slug";
import { resolveLoyaltyConfig } from "@/lib/loyalty/config";
import { loadLoyaltyBalance } from "@/lib/loyalty/points";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Points balance for the logged-in customer at one store, plus the
 * redemption terms the checkout needs to preview the discount. Guests
 * (no customer session) get { member: false } - redemption requires a
 * durable identity to charge the points against.
 */
export const GET = handler(async (req: Request) => {
  const url = new URL(req.url);
  const slug = url.searchParams.get("tenant");
  if (!slug) return apiError("validation_error", "missing tenant", 422);

  const tenant = await resolveTenantBySlug(slug);
  if (!tenant) return apiError("not_found", "מסעדה לא נמצאה", 404);

  const session = await getSession();
  if (session?.type !== "customer") {
    return apiJson({ member: false });
  }

  const tenantRow = await prisma.tenant.findUnique({
    where: { id: tenant.id },
    select: { loyaltyConfig: true },
  });
  const config = resolveLoyaltyConfig(tenantRow?.loyaltyConfig);

  const membership = await prisma.loyaltyMember.findUnique({
    where: { tenantId_customerId: { tenantId: tenant.id, customerId: session.userId } },
    select: { id: true },
  });
  if (!membership) {
    return apiJson({ member: false });
  }

  const { balance, tier } = await loadLoyaltyBalance(tenant.id, session.userId, config);

  return apiJson({
    member: true,
    balance,
    tier,
    redemption: {
      enabled: config.redemption.enabled,
      point_value_agorot: config.redemption.pointValueAgorot,
      max_percent_of_order: config.redemption.maxPercentOfOrder,
      min_points: config.redemption.minPoints,
    },
  });
});
