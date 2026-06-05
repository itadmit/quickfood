/**
 * Custom-domain management - Shopify-style.
 *
 *   GET    → current domain state for this tenant: hostname, status, the
 *            DNS records the merchant must set (A / CNAME / TXT), and any
 *            last error.
 *   POST   → add a domain. Calls Vercel `addDomain` + `getDomainConfig`,
 *            persists the verification challenge (if any) and the
 *            recommended DNS records, marks status = 'pending'.
 *   DELETE → remove the active/pending domain from Vercel and clear all
 *            tenant fields. Falls back gracefully if the domain was
 *            already missing from Vercel.
 *
 * Only the merchant owner/manager can change this.
 */

import { z } from "zod";
import { apiError, apiJson, handler } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import {
  addDomain,
  getDomainConfig,
  isApexHostname,
  isVercelConfigured,
  normalizeHostname,
  removeDomain,
  VercelApiError,
  VercelNotConfiguredError,
  type VercelAddDomainResponse,
  type VercelDomainConfig,
} from "@/lib/vercel/domains";

const NOT_CONFIGURED_MSG =
  "פיצ׳ר הדומיין המותאם עדיין לא הופעל אצלך. פנה אלינו לתמיכה.";
import { CustomDomainStatus, Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PostSchema = z.object({
  domain: z.string().trim().min(3).max(200),
});

interface DnsRecord {
  type: "A" | "CNAME" | "TXT";
  name: string;
  value: string;
}

interface StoredConfig extends VercelDomainConfig {
  apexName?: string;
}

function buildDnsRecords(
  hostname: string,
  config: StoredConfig | null,
  verification: VercelAddDomainResponse["verification"],
): DnsRecord[] {
  const records: DnsRecord[] = [];
  // Vercel's apexName (when we have it) is the authoritative answer for
  // "is this the zone apex?". Falls back to a multi-part TLD heuristic
  // that handles .co.il / .co.uk / .com.au and friends.
  const apex = isApexHostname(hostname, config?.apexName);
  const subname = apex
    ? "@"
    : config?.apexName && hostname.endsWith(config.apexName)
      ? hostname.slice(0, hostname.length - config.apexName.length - 1)
      : hostname.split(".").slice(0, -2).join(".");

  if (apex) {
    const ip = config?.recommendedIPv4?.[0]?.value?.[0] ?? "76.76.21.21";
    records.push({ type: "A", name: "@", value: ip });
  } else {
    const target = config?.recommendedCNAME?.[0]?.value ?? "cname.vercel-dns.com";
    records.push({ type: "CNAME", name: subname, value: target });
  }

  for (const v of verification ?? []) {
    if (v.type?.toUpperCase() === "TXT") {
      // Vercel returns the FQDN in `domain` - surface a "name" portion
      // relative to the user's apex so they can paste straight into the
      // DNS console.
      const txtName = v.domain.endsWith(hostname)
        ? v.domain.slice(0, v.domain.length - hostname.length - 1) || "@"
        : v.domain;
      records.push({ type: "TXT", name: txtName, value: v.value });
    }
  }

  return records;
}

function serializeState(t: {
  customDomain: string | null;
  customDomainStatus: CustomDomainStatus;
  customDomainVerification: Prisma.JsonValue;
  customDomainConfig: Prisma.JsonValue;
  customDomainAddedAt: Date | null;
  customDomainVerifiedAt: Date | null;
  customDomainLastError: string | null;
}) {
  const verification = (t.customDomainVerification as VercelAddDomainResponse["verification"]) ?? null;
  const config = (t.customDomainConfig as StoredConfig | null) ?? null;
  const dnsRecords = t.customDomain
    ? buildDnsRecords(t.customDomain, config, verification ?? undefined)
    : [];

  return {
    domain: t.customDomain,
    status: t.customDomainStatus,
    added_at: t.customDomainAddedAt?.toISOString() ?? null,
    verified_at: t.customDomainVerifiedAt?.toISOString() ?? null,
    last_error: t.customDomainLastError,
    dns_records: dnsRecords,
    misconfigured: config?.misconfigured ?? null,
    configured_by: config?.configuredBy ?? null,
  };
}

export const GET = handler(async () => {
  const session = await requireMerchant();
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
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
  if (!tenant) return apiError("not_found", "tenant not found", 404);
  return apiJson(serializeState(tenant));
});

export const POST = handler(async (req: Request) => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);

  if (!isVercelConfigured()) {
    return apiError("not_configured", NOT_CONFIGURED_MSG, 503);
  }

  const { domain: raw } = PostSchema.parse(await req.json());
  const hostname = normalizeHostname(raw);
  if (!hostname) {
    return apiError("validation_error", "כתובת הדומיין אינה תקינה", 422, "domain");
  }

  // Make sure no other tenant has grabbed this hostname.
  const existing = await prisma.tenant.findFirst({
    where: { customDomain: hostname, NOT: { id: session.tenantId } },
    select: { id: true },
  });
  if (existing) {
    return apiError("conflict", "הדומיין כבר רשום לחנות אחרת", 409, "domain");
  }

  // If the same tenant already has a different domain set, clear it from
  // Vercel before swapping - we keep a single domain per tenant for now.
  const current = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: { customDomain: true },
  });
  if (current?.customDomain && current.customDomain !== hostname) {
    try {
      await removeDomain(current.customDomain);
    } catch (err) {
      console.warn("[domain] swap-remove failed", current.customDomain, err);
    }
  }

  let addRes: VercelAddDomainResponse;
  try {
    addRes = await addDomain(hostname);
  } catch (err) {
    if (err instanceof VercelApiError) {
      if (err.status === 401 || err.status === 403) {
        // Token is set but Vercel rejected it. Surface this clearly so the
        // operator (us, not the merchant) knows to rotate the token in
        // env. Logged loudly so it shows up in dashboards.
        console.error("[domain] Vercel auth failed (token invalid?)", err.message);
        return apiError(
          "vercel_auth_failed",
          "בעיה בחיבור לשרת ה-DNS. צוות התמיכה כבר קיבל התראה.",
          503,
        );
      }
      if (err.status === 409) {
        return apiError("conflict", err.message || "הדומיין כבר תפוס ב-Vercel", 409, "domain");
      }
      if (err.status === 400) {
        return apiError("validation_error", err.message || "דומיין לא תקין", 422, "domain");
      }
      if (err.status === 402) {
        return apiError(
          "billing_required",
          "חשבון ה-Vercel דורש עדכון אמצעי תשלום.",
          503,
        );
      }
    }
    throw err;
  }

  let config: VercelDomainConfig | null = null;
  try {
    config = await getDomainConfig(hostname);
  } catch (err) {
    // Non-fatal - we'll show the default A record (76.76.21.21) and let
    // the merchant verify later when DNS propagates.
    console.warn("[domain] getDomainConfig failed", hostname, err);
  }

  const verifiedNow = addRes.verified && !(config?.misconfigured ?? true);

  // Persist `apexName` alongside the Vercel config so the DNS-records
  // builder can choose A vs CNAME correctly for `.co.il` and other
  // multi-part TLDs on future reads (GET / verify) - those code paths
  // don't re-call Vercel's addDomain so apexName isn't otherwise around.
  const storedConfig: StoredConfig | null = config
    ? { ...config, apexName: addRes.apexName }
    : addRes.apexName
      ? ({ apexName: addRes.apexName } as StoredConfig)
      : null;

  const updated = await prisma.tenant.update({
    where: { id: session.tenantId },
    data: {
      customDomain: hostname,
      customDomainStatus: verifiedNow ? CustomDomainStatus.active : CustomDomainStatus.pending,
      customDomainVerification: (addRes.verification ?? []) as unknown as Prisma.InputJsonValue,
      customDomainConfig: (storedConfig ?? null) as unknown as Prisma.InputJsonValue,
      customDomainAddedAt: new Date(),
      customDomainVerifiedAt: verifiedNow ? new Date() : null,
      customDomainLastError: null,
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

  return apiJson(serializeState(updated), 201);
});

export const DELETE = handler(async () => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);

  const t = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: { customDomain: true },
  });
  if (!t) return apiError("not_found", "tenant not found", 404);

  if (t.customDomain && isVercelConfigured()) {
    try {
      await removeDomain(t.customDomain);
    } catch (err) {
      if (err instanceof VercelNotConfiguredError) {
        // platform never had a token - nothing to clean up upstream
      } else if (!(err instanceof VercelApiError) || err.status !== 404) {
        console.warn("[domain] remove failed", t.customDomain, err);
      }
    }
  }

  await prisma.tenant.update({
    where: { id: session.tenantId },
    data: {
      customDomain: null,
      customDomainStatus: CustomDomainStatus.none,
      customDomainVerification: Prisma.DbNull,
      customDomainConfig: Prisma.DbNull,
      customDomainAddedAt: null,
      customDomainVerifiedAt: null,
      customDomainLastError: null,
    },
  });

  return apiJson({ ok: true });
});
