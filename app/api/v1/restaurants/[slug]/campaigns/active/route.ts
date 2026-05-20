import { handler, apiJson, apiError } from "@/lib/api-response";
import { resolveTenantBySlug } from "@/lib/slug";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public endpoint — returns the single most recently updated active campaign
 * for the tenant (or null). Used by the customer storefront to render the
 * promo popup on the home page.
 */
export const GET = handler(async (_req, { params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params;
  const tenant = await resolveTenantBySlug(slug);
  if (!tenant) return apiError("not_found", "מסעדה לא נמצאה", 404);

  const campaign = await prisma.campaign.findFirst({
    where: { tenantId: tenant.id, isActive: true },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, imageUrl: true, linkUrl: true, updatedAt: true },
  });

  return apiJson({ campaign });
});
