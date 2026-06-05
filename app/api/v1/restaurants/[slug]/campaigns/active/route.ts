import { handler, apiJson, apiError } from "@/lib/api-response";
import { resolveTenantBySlug } from "@/lib/slug";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public endpoint - returns the single most recently updated active campaign
 * for the tenant (or null). The optional ?kind=popup|banner filter lets the
 * customer storefront pull only the campaign type it wants to render
 * (popup overlay vs. inline home banner).
 */
export const GET = handler(async (req: Request, { params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params;
  const tenant = await resolveTenantBySlug(slug);
  if (!tenant) return apiError("not_found", "מסעדה לא נמצאה", 404);

  const kindParam = new URL(req.url).searchParams.get("kind");
  const kind = kindParam === "popup" || kindParam === "banner" ? kindParam : undefined;

  const campaign = await prisma.campaign.findFirst({
    where: { tenantId: tenant.id, isActive: true, ...(kind && { kind }) },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      kind: true,
      style: true,
      title: true,
      subtitle: true,
      icon: true,
      color: true,
      imageUrl: true,
      linkUrl: true,
      updatedAt: true,
    },
  });

  return apiJson({ campaign });
});
