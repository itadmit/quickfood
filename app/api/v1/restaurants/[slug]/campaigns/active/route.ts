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

  const searchParams = new URL(req.url).searchParams;
  const kindParam = searchParams.get("kind");
  const kind = kindParam === "popup" || kindParam === "banner" ? kindParam : undefined;

  // Popup placement: the storefront says which page it's on ("home" /
  // "cart" / anything else) and gets popups targeted at that page or at
  // "all". No page param keeps the legacy behaviour (no filter).
  const pageParam = searchParams.get("page");
  const placements =
    pageParam === "home" || pageParam === "cart"
      ? ([pageParam, "all"] as const)
      : pageParam
        ? (["all"] as const)
        : null;

  const campaign = await prisma.campaign.findFirst({
    where: {
      tenantId: tenant.id,
      isActive: true,
      ...(kind && { kind }),
      ...(kind === "popup" && placements ? { placement: { in: [...placements] } } : {}),
    },
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
