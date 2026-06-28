import { handler, apiJson, apiError } from "@/lib/api-response";
import { prisma } from "@/lib/db/client";
import { resolveLandingCopy } from "@/lib/growth/landing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public: returns the one-time landing modal content for a QR campaign, so the
 * storefront can show it over the menu (no separate page). Returns
 * { landing: null } when the campaign isn't a landing type, so the client
 * simply renders nothing.
 */
export const GET = handler(async (req: Request) => {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  const code = url.searchParams.get("code");
  if (!slug || !code) return apiError("validation_error", "slug and code required", 422);

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, name: true },
  });
  if (!tenant) return apiJson({ landing: null });

  const campaign = await prisma.qrCampaign.findUnique({
    where: { code },
    select: {
      tenantId: true,
      status: true,
      destinationType: true,
      landingTemplate: true,
      landingCopy: true,
    },
  });
  if (
    !campaign ||
    campaign.tenantId !== tenant.id ||
    campaign.status !== "active" ||
    campaign.destinationType !== "landing"
  ) {
    return apiJson({ landing: null });
  }

  const copy = resolveLandingCopy(campaign.landingTemplate, campaign.landingCopy, tenant.name);
  return apiJson({ landing: copy });
});
