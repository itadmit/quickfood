import { handler, apiJson } from "@/lib/api-response";
import { prisma } from "@/lib/db/client";
import { resolveTenantBySlug } from "@/lib/slug";
import { getSession } from "@/lib/auth/session";
import { israelStartOfDay } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public storefront add-to-cart beacon. Bumps one counter row per
 * (tenant, Israel-day). A merchant adding items while previewing their OWN
 * store is skipped so self-tests don't inflate the funnel. Always returns ok -
 * tracking must never disrupt the storefront.
 */
export const POST = handler(async (req: Request) => {
  const body = (await req.json().catch(() => null)) as { tenant_slug?: string } | null;
  const slug = body?.tenant_slug;
  if (!slug) return apiJson({ ok: true });

  const tenant = await resolveTenantBySlug(slug);
  if (!tenant) return apiJson({ ok: true });

  const session = await getSession();
  if (session?.type === "merchant" && session.tenantId === tenant.id) {
    return apiJson({ ok: true });
  }

  const day = israelStartOfDay(new Date());

  await prisma.storefrontCartAdd.upsert({
    where: { tenantId_day: { tenantId: tenant.id, day } },
    create: { tenantId: tenant.id, day },
    update: { adds: { increment: 1 }, lastAt: new Date() },
  });

  return apiJson({ ok: true });
});
