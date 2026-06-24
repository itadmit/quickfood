/**
 * One-off messaging top-up (SMS or WhatsApp). Charges the merchant's saved
 * card via QuickBilling's `POST /api/v1/charges` and adds the package quota
 * to the channel's own counter (`smsCreditsRemaining` / `whatsappCreditsRemaining`).
 *
 * The merchant can stack purchases - buy Starter (300) today, buy Growth
 * (1000) tomorrow, end up with 1300 credits. No subscriptions, no monthly
 * reset, no proration headaches.
 *
 * Idempotency: we mint a UUID per call and send it both in the body and as
 * the `X-Idempotency-Key` header (the hub stores it and replays the same
 * response for retries). Credits are added synchronously on a 200 response
 * AND topped up again from `charge.succeeded` webhook (guarded by invoice_id)
 * so we cover the case where our local code crashes between the hub call
 * and the credit increment.
 */
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { createCharge, BillingHubError } from "@/lib/billing-hub/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Base prices, pre-VAT. The hub adds 18% on top - Starter ends up ~₪46.02
// on the merchant's card, Growth ~₪93.22, Scale ~₪352.82. WhatsApp mirrors
// the SMS tiers for now; kept separate so pricing can diverge later.
const SMS_PACKAGES = {
  starter: { quota: 300, baseIls: 39, label: "Starter - 300 הודעות" },
  growth: { quota: 1000, baseIls: 79, label: "Growth - 1,000 הודעות" },
  scale: { quota: 5000, baseIls: 299, label: "Scale - 5,000 הודעות" },
} as const;

const WHATSAPP_PACKAGES = {
  starter: { quota: 300, baseIls: 39, label: "Starter - 300 הודעות" },
  growth: { quota: 1000, baseIls: 79, label: "Growth - 1,000 הודעות" },
  scale: { quota: 5000, baseIls: 299, label: "Scale - 5,000 הודעות" },
} as const;

const Schema = z.object({
  channel: z.enum(["sms", "whatsapp"]).default("sms"),
  package: z.enum(["starter", "growth", "scale"]),
});

export const POST = handler(async (req: Request) => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const { channel, package: pkgKey } = Schema.parse(await req.json());

  const isWa = channel === "whatsapp";
  const pkg = (isWa ? WHATSAPP_PACKAGES : SMS_PACKAGES)[pkgKey];
  // SMS keeps the legacy ledger kind so existing rows / in-flight webhooks
  // still dedupe; WhatsApp gets a distinct kind for clean observability.
  const ledgerKind = isWa ? "wa_topup_credit" : "topup_credit";
  const chargeKind = isWa ? "whatsapp_topup" : "sms_topup";
  const channelLabel = isWa ? "WhatsApp" : "SMS";
  const creditField = isWa ? "whatsappCreditsRemaining" : "smsCreditsRemaining";

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: {
      id: true,
      billingCustomerId: true,
      billingPaymentMethodId: true,
    },
  });
  if (!tenant) return apiError("not_found", "tenant not found", 404);

  if (!tenant.billingCustomerId || !tenant.billingPaymentMethodId) {
    return apiError(
      "billing_setup_required",
      `יש להשלים הגדרת חיוב לפני רכישת חבילת ${channelLabel}`,
      409,
    );
  }

  const idempotencyKey = `${chargeKind}:${tenant.id}:${randomUUID()}`;
  // The WhatsApp purchase also unlocks the BYO connection UI (durable latch).
  const creditData = isWa
    ? { whatsappCreditsRemaining: { increment: pkg.quota }, whatsappEnabled: true }
    : { smsCreditsRemaining: { increment: pkg.quota } };

  try {
    const charge = await createCharge({
      customer_id: tenant.billingCustomerId,
      amount: pkg.baseIls,
      description: `${channelLabel} ${pkg.label}`,
      idempotency_key: idempotencyKey,
      payment_method_id: tenant.billingPaymentMethodId,
      metadata: {
        tenant_id: tenant.id,
        kind: chargeKind,
        package: pkgKey,
        sms_quota: pkg.quota,
      },
    });

    if (!charge.ok) {
      return apiError(
        charge.reason ?? "charge_failed",
        charge.error ?? "החיוב נכשל",
        402,
      );
    }

    // Credit immediately. The webhook handler also covers this with an
    // idempotency guard (matched by `invoice_id` in SmsLog), so even if
    // this branch never runs the credits will still get added.
    if (charge.invoice_id) {
      const already = await prisma.smsLog.findFirst({
        where: {
          tenantId: tenant.id,
          kind: ledgerKind,
          refKind: "invoice",
          refId: charge.invoice_id,
        },
        select: { id: true },
      });
      if (!already) {
        await prisma.$transaction([
          prisma.smsLog.create({
            data: {
              tenantId: tenant.id,
              to: "",
              sender: "",
              body: `top-up credit: +${pkg.quota} (${channelLabel} ${pkgKey})`,
              kind: ledgerKind,
              refKind: "invoice",
              refId: charge.invoice_id,
              status: "sent",
              sentAt: new Date(),
            },
          }),
          prisma.tenant.update({
            where: { id: tenant.id },
            data: creditData,
          }),
        ]);
      }
    } else {
      // No invoice id returned (rare) - credit without dedupe; webhook will
      // not be able to match, but at least the merchant gets what they paid for.
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: creditData,
      });
    }

    const fresh = await prisma.tenant.findUnique({
      where: { id: tenant.id },
      select: { smsCreditsRemaining: true, whatsappCreditsRemaining: true },
    });

    return apiJson({
      ok: true,
      channel,
      credits_remaining: isWa
        ? fresh?.whatsappCreditsRemaining ?? 0
        : fresh?.smsCreditsRemaining ?? 0,
      added: pkg.quota,
      invoice_id: charge.invoice_id ?? null,
      invoice_url: charge.invoice_url ?? null,
      base_amount: charge.base_amount ?? pkg.baseIls,
      vat_amount: charge.vat_amount ?? null,
      total_amount: charge.total_amount ?? null,
    });
  } catch (err) {
    if (err instanceof BillingHubError) {
      return apiError(err.code ?? "billing_failed", err.message, err.status);
    }
    throw err;
  }
});
