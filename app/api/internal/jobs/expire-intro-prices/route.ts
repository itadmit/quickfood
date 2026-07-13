/**
 * QStash-invoked daily job: expire negotiated intro prices.
 *
 * Tenants with introMonthlyPrice set and introPriceUntil in the past get
 * their hub subscription's custom_monthly_price cleared (reverting the next
 * renewal to the regular plan price) and the local fields wiped. Tenants
 * that never completed billing setup just get the fields wiped - the intro
 * window has passed, so a later setup charges full price.
 *
 * Registered in scripts/register-qstash-schedules.ts (daily). Failures leave
 * the row untouched, so the next daily fire retries.
 */
import { handler, apiJson, apiError } from "@/lib/api-response";
import { verifySignature } from "@/lib/qstash/client";
import { prisma } from "@/lib/db/client";
import { patchSubscription, BillingHubError } from "@/lib/billing-hub/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async (req: Request) => {
  const rawBody = await req.text();
  const ok = await verifySignature(req, rawBody);
  if (!ok) {
    return apiError("unauthorized", "invalid qstash signature", 401);
  }

  const expired = await prisma.tenant.findMany({
    where: {
      introMonthlyPrice: { not: null },
      introPriceUntil: { lte: new Date() },
    },
    select: { id: true, name: true, billingSubscriptionId: true },
  });

  const results: Array<{ tenant_id: string; status: string }> = [];
  for (const t of expired) {
    try {
      if (t.billingSubscriptionId) {
        await patchSubscription(t.billingSubscriptionId, {
          custom_monthly_price: null,
        });
      }
      await prisma.tenant.update({
        where: { id: t.id },
        data: { introMonthlyPrice: null, introPriceUntil: null },
      });
      results.push({ tenant_id: t.id, status: "reverted" });
    } catch (err) {
      const msg = err instanceof BillingHubError ? `${err.status} ${err.message}` : String(err);
      console.error(`[expire-intro-prices] ${t.name} (${t.id}) failed: ${msg}`);
      results.push({ tenant_id: t.id, status: "failed" });
    }
  }

  return apiJson({ ok: true, processed: results.length, results });
});
