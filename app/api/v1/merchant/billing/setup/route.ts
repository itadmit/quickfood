/**
 * Initiate (or re-initiate) payment-method setup via QuickBilling Hub.
 *
 * Used when a merchant skipped the tokenization step at signup, OR needs to
 * replace their saved card. Returns a `setup_url` the client redirects to;
 * after the customer completes tokenization, the hub fires
 * `payment_method.created` which kicks off the base subscription.
 */
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import {
  createCustomer,
  createPaymentMethodSetup,
  BillingHubError,
} from "@/lib/billing-hub/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async (req: Request) => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);

  // The merchant must have ticked the "I authorize storing my card"
  // checkbox in the UI before this call. The hub also enforces it (returns
  // 400 if accept!=true) but rejecting here gives a clean local error
  // instead of relying on the remote response.
  const body = (await req.json().catch(() => ({}))) as {
    accept?: boolean;
    context_type?: "subscription_setup" | "card_update";
  };
  if (body.accept !== true) {
    return apiError(
      "consent_required",
      "יש לאשר את שמירת פרטי האשראי לחיוב עתידי לפני שמתחילים",
      400,
    );
  }
  const contextType: "subscription_setup" | "card_update" =
    body.context_type === "card_update" ? "card_update" : "subscription_setup";

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
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
  });
  if (!tenant) return apiError("not_found", "tenant not found", 404);

  const owner = tenant.merchantUsers[0];
  const ownerEmail = owner?.email;
  if (!ownerEmail) {
    return apiError("invalid_state", "אין משתמש בעלים על העסק", 409);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";

  // Upsert the billing customer (idempotent by email on the hub) and repoint
  // the tenant to whatever id the hub returns. Used both for first-time setup
  // and to self-heal a stale/dangling billingCustomerId (see below).
  const ensureBillingCustomer = async (): Promise<string> => {
    const customer = await createCustomer({
      email: ownerEmail,
      name: tenant.name,
      phone: owner?.phone ?? undefined,
      vat_number: tenant.vatNumber ?? undefined,
      external_id: tenant.id,
      external_slug: tenant.slug,
      metadata: { tenant_id: tenant.id },
    });
    if (customer.id !== tenant.billingCustomerId) {
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { billingCustomerId: customer.id },
      });
    }
    return customer.id;
  };

  try {
    let billingCustomerId = tenant.billingCustomerId ?? (await ensureBillingCustomer());

    // subscription_setup: charge the first month's ₪299 (+VAT) so the
    // token is captured along with month 1; card_update: chargeType=3
    // verification with ₪1 hold, no recurring billing yet.
    const runSetup = (customerId: string) =>
      createPaymentMethodSetup({
        customer_id: customerId,
        accept: true,
        context_type: contextType,
        amount: contextType === "card_update" ? 1 : 299,
        success_url: `${appUrl}/dashboard/billing?setup=complete`,
        failure_url: `${appUrl}/dashboard/billing?setup=failed`,
      });

    let setup: Awaited<ReturnType<typeof runSetup>>;
    try {
      setup = await runSetup(billingCustomerId);
    } catch (err) {
      // Self-heal: a stored billingCustomerId that points to a customer which
      // no longer exists on the hub (legacy/sandbox onboarding) makes the hub
      // return 404 CUSTOMER_NOT_FOUND. Re-create the customer, repoint the
      // tenant, and retry once.
      if (err instanceof BillingHubError && err.status === 404) {
        billingCustomerId = await ensureBillingCustomer();
        setup = await runSetup(billingCustomerId);
      } else {
        throw err;
      }
    }

    return apiJson({
      setup_url: setup.payment_page_url,
      setup_id: setup.session_id,
    });
  } catch (err) {
    if (err instanceof BillingHubError) {
      return apiError(err.code ?? "billing_failed", err.message, err.status);
    }
    throw err;
  }
});
