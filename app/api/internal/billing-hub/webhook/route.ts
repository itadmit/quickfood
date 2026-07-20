/**
 * Quick Commerce Billing Hub webhook receiver.
 *
 * Verifies the HMAC signature (X-Quickcommerce-Signature: sha256=<hex>) and
 * reacts to the events QuickFood cares about:
 *   - payment_method.created  → mirror IDs + create base subscription as
 *                                'active' (trial_days:0; first month was already
 *                                paid upfront via the setup amount, so the hub's
 *                                next invoice fires one month from setup).
 *   - subscription.created    → mirror sub id (idempotent).
 *   - invoice.paid (base)     → bump billingSetupCompletedAt.
 *   - charge.succeeded        → SMS top-up paid → add credits per metadata.
 *   - subscription.cancelled  → clear local subscription id.
 *   - invoice.failed / charge.failed / etc. → currently no-op.
 *
 * Tenant lookup: events carry `data.customer_id`. We resolve to a Tenant via
 * `billingCustomerId` (no reliance on metadata echo).
 */
import { handler, apiJson, apiError } from "@/lib/api-response";
import { prisma } from "@/lib/db/client";
import {
  verifyWebhook,
  createSubscription,
  BillingHubError,
} from "@/lib/billing-hub/client";
import { REVIEWS_WHATSAPP_PLAN_CODE, activeIntroPrice } from "@/lib/billing-hub/plans";
import { sendCapiEvent } from "@/lib/fb/capi";
import { after } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE_PLAN_CODE = "quickfood_base";
// First month already paid via the payment-methods/setup `amount` (₪352.82).
// trial_days:0 → the hub creates the subscription 'active' (a paying customer
// is NOT a trial) with the next invoice one calendar month after setup. Do NOT
// use a positive value here: the hub sets period_end = trialEnd + 1 month, which
// would double-defer billing by ~2 months AND leave the sub showing as 'trial'.
const BASE_TRIAL_DAYS_AFTER_SETUP = 0;
// Net (ex-VAT) base-plan price reported as the Purchase conversion value, kept
// in step with the CompleteRegistration value so Meta sees a consistent funnel.
const BASE_PLAN_VALUE_ILS = 299;

interface WebhookEvent {
  event: string;
  data: Record<string, unknown>;
}

async function findTenantByCustomerId(customerId: string) {
  if (!customerId) return null;
  return prisma.tenant.findFirst({
    where: { billingCustomerId: customerId },
    select: {
      id: true,
      billingCustomerId: true,
      billingSubscriptionId: true,
      billingPaymentMethodId: true,
      smsCreditsRemaining: true,
      reviewsWhatsappSubscriptionId: true,
      reviewsChannel: true,
      introMonthlyPrice: true,
      introPriceUntil: true,
      fbp: true,
      fbc: true,
      merchantUsers: {
        where: { role: "owner" },
        take: 1,
        select: { email: true, phone: true },
      },
      branches: {
        where: { isPrimary: true },
        take: 1,
        select: { phone: true },
      },
    },
  });
}

export const POST = handler(async (req: Request) => {
  const rawBody = await req.text();
  if (!verifyWebhook(rawBody, req.headers)) {
    return apiError("unauthorized", "invalid signature", 401);
  }

  const event = JSON.parse(rawBody) as WebhookEvent;

  switch (event.event) {
    case "payment_method.created": {
      const d = event.data as {
        customer_id: string;
        payment_method_id?: string;
        id?: string;
      };
      const tenant = await findTenantByCustomerId(d.customer_id);
      if (!tenant) break;

      const paymentMethodId = d.payment_method_id ?? d.id ?? null;
      // First time a token lands = the trial→paid conversion (fires whether
      // the merchant paid during or after the trial - both routes save the
      // payment method here). Guard on the pre-update value so retries / card
      // updates don't re-fire it.
      const isFirstSetup = !tenant.billingPaymentMethodId;
      if (paymentMethodId) {
        await prisma.tenant.update({
          where: { id: tenant.id },
          data: {
            billingPaymentMethodId: paymentMethodId,
            // Token is on file - mark setup complete + close out the local
            // trial so the dashboard banner / lock disappear.
            billingSetupCompletedAt: new Date(),
          },
        });
      }

      // Report the paid conversion to Meta server-side. The webhook has no
      // browser context, so we lean on the hashed owner email/phone plus the
      // fbp/fbc stashed at signup to match it back to CompleteRegistration. A
      // deterministic event_id makes duplicate webhooks a no-op for Meta.
      if (paymentMethodId && isFirstSetup) {
        const owner = tenant.merchantUsers[0];
        const branchPhone = tenant.branches[0]?.phone;
        after(async () => {
          try {
            await sendCapiEvent({
              eventName: "Purchase",
              eventId: `purchase:${tenant.id}`,
              params: {
                currency: "ILS",
                value: BASE_PLAN_VALUE_ILS,
                content_name: BASE_PLAN_CODE,
              },
              email: owner?.email,
              phones: [owner?.phone, branchPhone],
              externalId: tenant.id,
              fbp: tenant.fbp,
              fbc: tenant.fbc,
            });
          } catch (err) {
            console.warn("[billing-webhook] Purchase CAPI failed", err);
          }
        });
      }

      // Create the base subscription if we haven't already. The hub already
      // charged ₪352.82 via the setup amount, so the subscription is created
      // 'active' (trial_days:0) with the next invoice one billing cycle from now.
      if (!tenant.billingSubscriptionId && paymentMethodId) {
        try {
          const introPrice = activeIntroPrice(tenant);
          const sub = await createSubscription({
            customer_id: d.customer_id,
            plan_code: BASE_PLAN_CODE,
            billing_interval: "monthly",
            trial_days: BASE_TRIAL_DAYS_AFTER_SETUP,
            payment_method_id: paymentMethodId,
            custom_monthly_price: introPrice ?? undefined,
            metadata: { tenant_id: tenant.id, kind: "base" },
          });
          await prisma.tenant.update({
            where: { id: tenant.id },
            data: { billingSubscriptionId: sub.id },
          });
        } catch (err) {
          if (err instanceof BillingHubError) {
            console.warn(
              "[billing-webhook] base subscription create failed",
              err.status,
              err.message,
            );
          } else {
            console.warn("[billing-webhook] base subscription create threw", err);
          }
        }
      }
      break;
    }

    case "subscription.created":
    case "subscription.updated": {
      const d = event.data as {
        customer_id: string;
        id?: string;
        subscription_id?: string;
        plan_code?: string;
      };
      const tenant = await findTenantByCustomerId(d.customer_id);
      if (!tenant) break;
      const subId = d.id ?? d.subscription_id;
      if (!subId || !d.plan_code) break;
      if (d.plan_code === BASE_PLAN_CODE) {
        await prisma.tenant.update({
          where: { id: tenant.id },
          data: { billingSubscriptionId: subId },
        });
      } else if (d.plan_code === REVIEWS_WHATSAPP_PLAN_CODE) {
        await prisma.tenant.update({
          where: { id: tenant.id },
          data: { reviewsWhatsappSubscriptionId: subId },
        });
      }
      break;
    }

    case "invoice.paid": {
      const d = event.data as {
        customer_id: string;
        plan_code?: string;
      };
      const tenant = await findTenantByCustomerId(d.customer_id);
      if (!tenant) break;
      // Any paid base-plan invoice keeps the setup-complete timestamp fresh.
      // We no longer reset SMS credits here - SMS purchases are now one-off
      // charges that fire `charge.succeeded` instead.
      if (d.plan_code === BASE_PLAN_CODE) {
        await prisma.tenant.update({
          where: { id: tenant.id },
          data: { billingSetupCompletedAt: new Date() },
        });
      }
      break;
    }

    case "charge.succeeded": {
      // SMS / WhatsApp top-up landed. Metadata carries the package + credit
      // quota that the /sms/purchase endpoint attached when creating the charge.
      const d = event.data as {
        customer_id: string;
        invoice_id?: string;
        amount?: number;
        metadata?: {
          tenant_id?: string;
          kind?: string;
          package?: string;
          sms_quota?: number | string;
        };
      };
      const isWa = d.metadata?.kind === "whatsapp_topup";
      if (d.metadata?.kind !== "sms_topup" && !isWa) break;
      const tenant = await findTenantByCustomerId(d.customer_id);
      if (!tenant) break;
      const quota = Number(d.metadata?.sms_quota ?? 0);
      if (!Number.isFinite(quota) || quota <= 0) break;

      // SMS keeps the legacy ledger kind; WhatsApp gets its own so the two
      // channels never share an idempotency row (invoice_id is unique anyway).
      const ledgerKind = isWa ? "wa_topup_credit" : "topup_credit";
      // WhatsApp purchase also flips the durable unlock latch.
      const creditData = isWa
        ? { whatsappCreditsRemaining: { increment: quota }, whatsappEnabled: true }
        : { smsCreditsRemaining: { increment: quota } };

      // Idempotency: re-check Tenant in case the /sms/purchase endpoint
      // already credited this top-up synchronously. We use the invoice_id
      // as a marker stored in SmsLog when present.
      if (d.invoice_id) {
        const already = await prisma.smsLog.findFirst({
          where: {
            tenantId: tenant.id,
            kind: ledgerKind,
            refKind: "invoice",
            refId: d.invoice_id,
          },
          select: { id: true },
        });
        if (already) break;
        // Mark this top-up as processed before we credit so we never
        // double-credit on duplicate webhooks.
        await prisma.smsLog.create({
          data: {
            tenantId: tenant.id,
            to: "",
            sender: "",
            body: `top-up credit: +${quota} (${isWa ? "WhatsApp " : ""}${d.metadata?.package ?? ""})`,
            kind: ledgerKind,
            refKind: "invoice",
            refId: d.invoice_id,
            status: "sent",
            sentAt: new Date(),
          },
        });
      }

      await prisma.tenant.update({
        where: { id: tenant.id },
        data: creditData,
      });
      break;
    }

    case "subscription.cancelled": {
      const d = event.data as {
        customer_id: string;
        id?: string;
        subscription_id?: string;
      };
      const tenant = await findTenantByCustomerId(d.customer_id);
      if (!tenant) break;
      const subId = d.id ?? d.subscription_id;
      if (!subId) break;
      if (subId === tenant.billingSubscriptionId) {
        await prisma.tenant.update({
          where: { id: tenant.id },
          data: { billingSubscriptionId: null, billingSetupCompletedAt: null },
        });
      } else if (subId === tenant.reviewsWhatsappSubscriptionId) {
        // Add-on ended - clear the mirror id. If the merchant had picked
        // `whatsapp_managed` as their reviews channel, flip it off so future
        // sends fail cleanly with `channel_off` rather than calling the
        // platform iBot account without an active subscription.
        await prisma.tenant.update({
          where: { id: tenant.id },
          data: {
            reviewsWhatsappSubscriptionId: null,
            ...(tenant.reviewsChannel === "whatsapp_managed" && {
              reviewsChannel: "off",
            }),
          },
        });
      }
      break;
    }

    case "customer.created":
    case "customer.updated":
    case "subscription.trial_will_end":
    case "invoice.refunded":
    case "charge.failed":
    case "charge.dunning_started":
    case "charge.recovered":
      // Currently no-op - hub handles dunning. Wire owner emails here when ready.
      break;

    default:
      break;
  }

  return apiJson({ ok: true });
});
