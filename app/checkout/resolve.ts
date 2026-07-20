import { prisma } from "@/lib/db/client";
import { KIOSK_CHECKOUT_REF_PREFIX } from "@/lib/orders/kiosk-checkout";

/**
 * Resolver for Grow's browser redirects (/checkout/thank-you|cancel|failed).
 *
 * These land when payment happens OUTSIDE the wallet iframe - Bit / PayBox
 * hop to an external app, so the SDK's client-side redirect never runs and
 * Grow sends the browser to the successUrl we set at initiate time. The
 * query carries cField1/ref = our orderReference (order number, or KCO-<id>
 * for a kiosk pending checkout) and cField2 = tenantId.
 */
export interface CheckoutRedirectTarget {
  /** Path to bounce the customer to; null = render the static fallback. */
  path: string | null;
}

type Search = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export async function resolveCheckoutRedirect(
  searchParams: Search,
  kind: "success" | "cancel" | "failed",
): Promise<CheckoutRedirectTarget> {
  // ref/cField1 = Grow's echo of our orderReference; ReturnValue = CardCom's.
  const ref =
    first(searchParams.ref) ||
    first(searchParams.cField1) ||
    first(searchParams.ReturnValue) ||
    first(searchParams.returnValue);
  const tenantId = first(searchParams.cField2);

  if (ref.startsWith(KIOSK_CHECKOUT_REF_PREFIX)) {
    const checkoutId = ref.slice(KIOSK_CHECKOUT_REF_PREFIX.length);
    const checkout = await prisma.kioskPendingCheckout.findUnique({
      where: { id: checkoutId },
      select: { tenant: { select: { slug: true } } },
    });
    return { path: checkout ? `/s/${checkout.tenant.slug}/kiosk` : null };
  }

  const order = ref
    ? await prisma.order.findFirst({
        where: {
          number: ref,
          ...(tenantId ? { tenantId } : {}),
        },
        orderBy: { createdAt: "desc" },
        select: { id: true, tenant: { select: { slug: true } } },
      })
    : null;

  if (order) {
    return {
      path:
        kind === "success"
          ? `/s/${order.tenant.slug}/orders/${order.id}`
          : `/s/${order.tenant.slug}/pay/${order.id}`,
    };
  }

  if (tenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { slug: true },
    });
    if (tenant) return { path: `/s/${tenant.slug}` };
  }

  return { path: null };
}
