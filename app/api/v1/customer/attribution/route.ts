import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { recordAttribution } from "@/lib/growth/attribution";
import { getSourcesForTenant } from "@/lib/growth/sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public, lightweight "how did you hear about us" answer. Never blocks
// checkout - the storefront fires this best-effort and ignores failures.
const Body = z.object({
  slug: z.string().min(1),
  source: z.string().min(1).max(40),
  firstTouchType: z.enum(["signup", "checkout", "qr", "loyalty"]).default("checkout"),
  campaignCode: z.string().max(32).optional(),
});

// Returns the tenant's active source options so the prompt can render them.
export const GET = handler(async (req: Request) => {
  const slug = new URL(req.url).searchParams.get("slug");
  if (!slug) return apiError("validation_error", "slug required", 422);
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, country: true },
  });
  if (!tenant) return apiError("not_found", "restaurant not found", 404);
  const sources = await getSourcesForTenant(tenant.id, tenant.country, { activeOnly: true });
  return apiJson({ sources: sources.map((s) => ({ key: s.sourceKey, label: s.sourceLabel })) });
});

export const POST = handler(async (req: Request) => {
  const body = Body.parse(await req.json());
  const tenant = await prisma.tenant.findUnique({
    where: { slug: body.slug },
    select: { id: true },
  });
  if (!tenant) return apiError("not_found", "restaurant not found", 404);

  const session = await getSession();
  const customerId = session?.type === "customer" ? session.userId : null;

  let campaignId: string | null = null;
  if (body.campaignCode) {
    const campaign = await prisma.qrCampaign.findUnique({
      where: { code: body.campaignCode },
      select: { id: true, tenantId: true },
    });
    if (campaign && campaign.tenantId === tenant.id) campaignId = campaign.id;
  }

  await recordAttribution({
    tenantId: tenant.id,
    source: body.source,
    firstTouchType: body.firstTouchType,
    customerId,
    campaignId,
    selfReported: true,
  });

  return apiJson({ ok: true });
});
