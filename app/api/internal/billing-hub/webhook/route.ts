/**
 * Quick Commerce Billing Hub webhook receiver.
 *
 * Verifies the HMAC signature (X-Quickcommerce-Signature: sha256=<hex>) and
 * reacts to the events QuickFood cares about:
 *   - payment_method.created  → mirror IDs + create base subscription with
 *                                trial_days:30 (first month was already paid
 *                                upfront via the setup amount, so the hub
 *                                shouldn't invoice again for 30 days).
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
import { REVIEWS_WHATSAPP_PLAN_CODE } from "@/lib/billing-hub/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE_PLAN_CODE = "quickfood_base";
// First month already paid via the payment-methods/setup `amount` (₪352.82).
// Defer the hub's automatic billing so the merchant isn't charged again
// before the cycle is over.
const BASE_TRIAL_DAYS_AFTER_SETUP = 30;

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
      if (paymentMethodId) {
        await prisma.tenant.update({
          where: { id: tenant.id },
          data: {
            billingPaymentMethodId: paymentMethodId,
            // Token is on file — mark setup complete + close out the local
            // trial so the dashboard banner / lock disappear.
            billingSetupCompletedAt: new Date(),
          },
        });
      }

      // Create the base subscription if we haven't already. The hub already
      // charged ₪352.82 via the setup amount, so the subscription rides on
      // a 30-day initial trial — the next invoice fires one billing cycle
      // from now.
      if (!tenant.billingSubscriptionId && paymentMethodId) {
        try {
          const sub = await createSubscription({
            customer_id: d.customer_id,
            plan_code: BASE_PLAN_CODE,
            billing_interval: "monthly",
            trial_days: BASE_TRIAL_DAYS_AFTER_SETUP,
            payment_method_id: paymentMethodId,
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
      // We no longer reset SMS credits here — SMS purchases are now one-off
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
      // SMS top-up landed. Metadata carries the package + credit quota that
      // the /sms/purchase endpoint attached when creating the charge.
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
      if (d.metadata?.kind !== "sms_topup") break;
      const tenant = await findTenantByCustomerId(d.customer_id);
      if (!tenant) break;
      const quota = Number(d.metadata?.sms_quota ?? 0);
      if (!Number.isFinite(quota) || quota <= 0) break;

      // Idempotency: re-check Tenant in case the /sms/purchase endpoint
      // already credited this top-up synchronously. We use the invoice_id
      // as a marker stored in SmsLog when present.
      if (d.invoice_id) {
        const already = await prisma.smsLog.findFirst({
          where: {
            tenantId: tenant.id,
            kind: "topup_credit",
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
            body: `top-up credit: +${quota} (${d.metadata?.package ?? ""})`,
            kind: "topup_credit",
            refKind: "invoice",
            refId: d.invoice_id,
            status: "sent",
            sentAt: new Date(),
          },
        });
      }

      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { smsCreditsRemaining: { increment: quota } },
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
        // Add-on ended — clear the mirror id. If the merchant had picked
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
      // Currently no-op — hub handles dunning. Wire owner emails here when ready.
      break;

    default:
      break;
  }

  return apiJson({ ok: true });
});
