/**
 * POST /api/v1/merchant/domain/verify
 *
 * Called by the merchant when they've set their DNS records and want
 * QuickFood to confirm the domain is live. Two checks happen in order:
 *
 *   1. If Vercel returned a TXT challenge when the domain was added, call
 *      `verifyDomain` first. A 400 here means DNS isn't propagated yet,
 *      so we keep status='pending' and surface the message.
 *   2. Always call `getDomainConfig` to see whether the A/CNAME records
 *      are now pointing at Vercel. `misconfigured=false` means Vercel
 *      can issue an SSL certificate.
 *
 * Both must succeed to flip status to 'active'. Once active the proxy
 * starts routing traffic from that hostname to the tenant.
 */

import { apiError, apiJson, handler } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import {
  getDomainConfig,
  isVercelConfigured,
  verifyDomain,
  VercelApiError,
  type VercelDomainConfig,
} from "@/lib/vercel/domains";
import { CustomDomainStatus, Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async () => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);

  if (!isVercelConfigured()) {
    return apiError(
      "not_configured",
      "פיצ׳ר הדומיין המותאם עדיין לא הופעל אצלך. פנה אלינו לתמיכה.",
      503,
    );
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: {
      customDomain: true,
      customDomainStatus: true,
      customDomainVerification: true,
      customDomainConfig: true,
    },
  });
  if (!tenant?.customDomain) {
    return apiError("not_found", "אין דומיין מוגדר", 404);
  }

  // Preserve `apexName` (and any other long-lived fields we add later)
  // when we refresh `customDomainConfig` from Vercel below — Vercel's
  // `/domains/{name}/config` response doesn't include apexName.
  const previousApexName = (tenant.customDomainConfig as { apexName?: string } | null)
    ?.apexName;

  const hostname = tenant.customDomain;
  const verification = (tenant.customDomainVerification ??
    []) as Array<{ type: string }>;
  const needsTxtVerify = verification.some(
    (v) => v.type?.toUpperCase() === "TXT",
  );

  let lastError: string | null = null;
  let verifiedOk = !needsTxtVerify;

  if (needsTxtVerify) {
    try {
      const res = await verifyDomain(hostname);
      verifiedOk = res.verified;
      if (!verifiedOk) {
        lastError = "ה-TXT record עדיין לא התפרסם. נסה שוב בעוד דקה.";
      }
    } catch (err) {
      verifiedOk = false;
      if (err instanceof VercelApiError) {
        if (err.status === 401 || err.status === 403) {
          console.error("[domain/verify] Vercel auth failed", err.message);
          return apiError(
            "vercel_auth_failed",
            "בעיה בחיבור לשרת ה-DNS. צוות התמיכה כבר קיבל התראה.",
            503,
          );
        }
        lastError = err.message || "אימות נכשל";
      } else {
        throw err;
      }
    }
  }

  let config: VercelDomainConfig | null = null;
  try {
    config = await getDomainConfig(hostname);
  } catch (err) {
    if (err instanceof VercelApiError) {
      if (err.status === 401 || err.status === 403) {
        console.error("[domain/verify] Vercel auth failed", err.message);
        return apiError(
          "vercel_auth_failed",
          "בעיה בחיבור לשרת ה-DNS. צוות התמיכה כבר קיבל התראה.",
          503,
        );
      }
      lastError = lastError ?? err.message;
    } else {
      throw err;
    }
  }

  const dnsOk = config !== null && !config.misconfigured;
  const fullyActive = verifiedOk && dnsOk;

  if (!fullyActive && lastError === null) {
    lastError = !dnsOk
      ? "רשומות ה-DNS עדיין לא מצביעות נכון. בדוק שה-A או ה-CNAME מעודכנים."
      : null;
  }

  const mergedConfig = config
    ? { ...config, ...(previousApexName ? { apexName: previousApexName } : {}) }
    : previousApexName
      ? { apexName: previousApexName }
      : null;

  const updated = await prisma.tenant.update({
    where: { id: session.tenantId },
    data: {
      customDomainStatus: fullyActive
        ? CustomDomainStatus.active
        : CustomDomainStatus.pending,
      customDomainVerifiedAt: fullyActive ? new Date() : null,
      customDomainConfig: (mergedConfig ?? null) as unknown as Prisma.InputJsonValue,
      customDomainLastError: fullyActive ? null : lastError,
    },
    select: {
      customDomain: true,
      customDomainStatus: true,
      customDomainVerification: true,
      customDomainConfig: true,
      customDomainAddedAt: true,
      customDomainVerifiedAt: true,
      customDomainLastError: true,
    },
  });

  return apiJson({
    ok: fullyActive,
    domain: updated.customDomain,
    status: updated.customDomainStatus,
    verified_at: updated.customDomainVerifiedAt?.toISOString() ?? null,
    last_error: updated.customDomainLastError,
    misconfigured: config?.misconfigured ?? null,
    configured_by: config?.configuredBy ?? null,
  });
});
