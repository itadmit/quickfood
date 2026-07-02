/**
 * One-shot backfill: ensure every Tenant has a VALID QuickBilling customer.
 *
 *   $ npx tsx --env-file=.env.local scripts/backfill-billing-customers.ts          # dry-run
 *   $ npx tsx --env-file=.env.local scripts/backfill-billing-customers.ts --apply  # execute
 *
 * Why: tenants that onboarded before the current billing integration (or
 * during the sandbox era) carry a `billingCustomerId` that points to a
 * customer which no longer exists in the prod billing DB - so QuickFood
 * sends that stale UUID to /payment-methods/setup and gets a 404
 * CUSTOMER_NOT_FOUND (e.g. pizza-strada / etay@negevdelivery.co.il).
 *
 * Fix: for each tenant, look up the billing customer by the owner's email.
 *  - match found & pointer already correct  → OK, leave untouched.
 *  - found but pointer null/stale           → repoint billingCustomerId.
 *  - not found                              → create it (upsert) + repoint.
 * createCustomer is an idempotent upsert-by-email on the billing side, so
 * running this for ALL tenants is safe and never creates duplicates.
 */
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const BASE = process.env.QC_BILLING_BASE_URL?.replace(/\/$/, "") ?? "";
const API_KEY = process.env.QC_BILLING_API_KEY ?? "";
const PRODUCT_ID = process.env.QC_BILLING_PRODUCT_ID ?? "quickfood";
const HMAC_SECRET = process.env.QC_BILLING_HMAC_SECRET ?? "";

const APPLY = process.argv.includes("--apply");

function sign(ts: string, rawBody: string): string {
  return crypto.createHmac("sha256", HMAC_SECRET).update(`${ts}.${rawBody}`).digest("hex");
}

async function billing<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<T> {
  const rawBody = body === undefined ? "" : JSON.stringify(body);
  const ts = Math.floor(Date.now() / 1000).toString();
  const headers: Record<string, string> = {
    "content-type": "application/json",
    Authorization: `Bearer ${API_KEY}`,
    "X-Product-Id": PRODUCT_ID,
    "X-Timestamp": ts,
    "X-Signature": sign(ts, rawBody),
  };
  if (method !== "GET") headers["X-Idempotency-Key"] = crypto.randomUUID();

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: rawBody || undefined,
    cache: "no-store",
  });
  const text = await res.text();
  const parsed = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(`billing ${method} ${path} → ${res.status}: ${text.slice(0, 300)}`);
  }
  return parsed as T;
}

type BillingCustomer = { id: string; email: string; name: string };

async function findByEmail(email: string): Promise<BillingCustomer | null> {
  const r = await billing<{ results: BillingCustomer[] }>(
    "GET",
    `/api/v1/customers?email=${encodeURIComponent(email)}`,
  );
  return r.results?.[0] ?? null;
}

async function main() {
  if (!BASE || !API_KEY || !HMAC_SECRET) {
    throw new Error("QC_BILLING_* env vars missing - run with --env-file=.env.local");
  }
  console.log(`\nBilling backfill — ${APPLY ? "APPLY" : "DRY-RUN"} — hub: ${BASE}\n`);

  const tenants = await prisma.tenant.findMany({
    select: {
      id: true,
      slug: true,
      name: true,
      vatNumber: true,
      billingCustomerId: true,
      merchantUsers: {
        where: { role: "owner" },
        select: { email: true, phone: true },
        take: 1,
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const stats = { ok: 0, created: 0, repointed: 0, noOwner: 0, failed: 0 };

  for (const t of tenants) {
    const owner = t.merchantUsers[0];
    const label = `${t.slug} (${owner?.email ?? "no-owner"})`;

    if (!owner?.email) {
      stats.noOwner++;
      console.log(`⚠️  SKIP  ${label} — no owner user, cannot create billing customer`);
      continue;
    }

    try {
      const existing = await findByEmail(owner.email);

      if (existing && existing.id === t.billingCustomerId) {
        stats.ok++;
        console.log(`✅ OK    ${label} — ${existing.id}`);
        continue;
      }

      const action = existing ? "REPOINT" : "CREATE";
      if (!APPLY) {
        console.log(
          `🔧 ${action} ${label} — stored=${t.billingCustomerId ?? "null"} → ${existing?.id ?? "(new)"}`,
        );
        if (existing) stats.repointed++;
        else stats.created++;
        continue;
      }

      // Upsert (creates if missing, returns existing otherwise) + sets the
      // quickfood product link / external_id, then repoint the tenant.
      const customer = await billing<BillingCustomer>("POST", "/api/v1/customers", {
        email: owner.email,
        name: t.name,
        phone: owner.phone ?? undefined,
        vat_number: t.vatNumber ?? undefined,
        external_id: t.id,
        external_slug: t.slug,
        metadata: { tenant_id: t.id },
      });

      await prisma.tenant.update({
        where: { id: t.id },
        data: { billingCustomerId: customer.id },
      });

      if (existing) stats.repointed++;
      else stats.created++;
      console.log(
        `✅ ${action} ${label} — ${t.billingCustomerId ?? "null"} → ${customer.id}`,
      );
    } catch (err) {
      stats.failed++;
      console.log(`❌ FAIL  ${label} — ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log(
    `\nDone. tenants=${tenants.length} ok=${stats.ok} created=${stats.created} repointed=${stats.repointed} noOwner=${stats.noOwner} failed=${stats.failed}`,
  );
  if (!APPLY) console.log("Dry-run only — re-run with --apply to write.\n");

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
