import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { recordScan, resolveQrDestination } from "@/lib/growth/qr";
import { recordAttribution } from "@/lib/growth/attribution";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VISITOR_COOKIE = "qf_vid";
const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Tracked QR redirect: /r/{slug}/q/{code}. Logs a QrScan (and a trusted,
 * NOT self-reported QR attribution when the scanner is a known customer),
 * then forwards to the campaign's destination with a ?src=qr_{code} marker
 * the storefront persists into checkout. Tracking must never block the
 * redirect - on any error we still send the scanner to the menu.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; code: string }> },
) {
  const { slug, code } = await params;

  const fallback = NextResponse.redirect(new URL(`/s/${slug}/menu`, req.url), 302);

  const [tenant, campaign] = await Promise.all([
    prisma.tenant.findUnique({ where: { slug }, select: { id: true } }),
    prisma.qrCampaign.findUnique({
      where: { code },
      select: {
        id: true,
        tenantId: true,
        status: true,
        code: true,
        destinationType: true,
        destinationUrl: true,
        landingTemplate: true,
      },
    }),
  ]);

  if (!tenant || !campaign || campaign.tenantId !== tenant.id || campaign.status !== "active") {
    return fallback;
  }

  // Real client IP behind Cloudflare is CF-Connecting-IP (NOT XFF[0]).
  const ip =
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null;

  let visitorId = req.cookies.get(VISITOR_COOKIE)?.value;
  const needsCookie = !visitorId || visitorId.length < 8 || visitorId.length > 64;
  if (needsCookie) visitorId = crypto.randomUUID();

  const session = await getSession().catch(() => null);
  const customerId = session?.type === "customer" ? session.userId : null;

  try {
    await recordScan({
      tenantId: tenant.id,
      campaignId: campaign.id,
      visitorId,
      ip,
      userAgent: req.headers.get("user-agent"),
      referrer: req.headers.get("referer"),
    });
    if (customerId) {
      // Trusted source - the scanner arrived through this campaign.
      await recordAttribution({
        tenantId: tenant.id,
        source: "flyer",
        sourceLabel: "QR",
        firstTouchType: "qr",
        customerId,
        campaignId: campaign.id,
        selfReported: false,
      });
    }
  } catch {
    // swallow - tracking is best-effort
  }

  const dest = resolveQrDestination(campaign, slug);
  const res = NextResponse.redirect(new URL(dest.url, req.url), 302);
  if (needsCookie) {
    res.cookies.set(VISITOR_COOKIE, visitorId!, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: ONE_YEAR,
      path: "/",
    });
  }
  return res;
}
