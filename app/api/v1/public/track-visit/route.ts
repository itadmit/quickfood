import { cookies } from "next/headers";
import { handler, apiJson } from "@/lib/api-response";
import { prisma } from "@/lib/db/client";
import { resolveTenantBySlug } from "@/lib/slug";
import { getSession } from "@/lib/auth/session";
import { israelStartOfDay } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VISITOR_COOKIE = "qf_vid";
const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Public storefront visit beacon. The customer page fires this once per tab
 * session; we dedupe to one row per (tenant, visitor, Israel-day) and bump a
 * counter. Visitor identity is the first-party `qf_vid` cookie (set here if
 * missing). Logged-in customers get their customerId stamped. A merchant
 * viewing their OWN storefront is skipped so previews don't inflate the
 * numbers. Always returns ok - tracking must never disrupt the storefront.
 */
export const POST = handler(async (req: Request) => {
  const body = (await req.json().catch(() => null)) as { tenant_slug?: string } | null;
  const slug = body?.tenant_slug;
  if (!slug) return apiJson({ ok: true });

  const tenant = await resolveTenantBySlug(slug);
  if (!tenant) return apiJson({ ok: true });

  const session = await getSession();
  // Don't count the owner/staff browsing their own store.
  if (session?.type === "merchant" && session.tenantId === tenant.id) {
    return apiJson({ ok: true });
  }
  const customerId = session?.type === "customer" ? session.userId : null;

  const jar = await cookies();
  let visitorId = jar.get(VISITOR_COOKIE)?.value;
  if (!visitorId || visitorId.length < 8 || visitorId.length > 64) {
    visitorId = crypto.randomUUID();
    jar.set(VISITOR_COOKIE, visitorId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: ONE_YEAR,
      path: "/",
    });
  }

  const day = israelStartOfDay(new Date());

  await prisma.storefrontVisit.upsert({
    where: {
      tenantId_visitorId_day: { tenantId: tenant.id, visitorId, day },
    },
    create: {
      tenantId: tenant.id,
      visitorId,
      customerId,
      day,
    },
    update: {
      visits: { increment: 1 },
      lastAt: new Date(),
      // Promote anon → identified the moment we learn the customerId.
      ...(customerId ? { customerId } : {}),
    },
  });

  return apiJson({ ok: true });
});
