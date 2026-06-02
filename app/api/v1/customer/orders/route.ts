import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { createOrder, CartValidationError } from "@/lib/orders-create";
import { toE164 } from "@/lib/format";
import { signReviewToken } from "@/lib/reviews/token";
import { initiateOrderPayment, type InitiatePaymentData } from "@/lib/payments/initiate-payment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CreateOrderSchema = z.object({
  tenant_slug: z.string().min(1),
  method: z.enum(["delivery", "pickup"]),
  address_id: z.string().uuid().optional(),
  delivery_notes: z.string().max(200).optional(),
  customer_notes: z.string().max(500).optional(),
  payment_method: z.enum(["card", "cash", "apple_pay", "google_pay", "bit"]).default("cash"),
  tip: z.number().int().min(0).default(0),
  cutlery_count: z.number().int().min(0).max(20).default(0),
  scheduled_for: z.string().datetime().optional(),
  guest_phone: z.string().optional(),
  guest_first_name: z.string().min(1).max(40).optional(),
  guest_last_name: z.string().max(40).optional(),
  customer_email: z.string().email().optional(),
  // Explicit opt-in to marketing/promotional comms — only persisted
  // when true; never silently flips an existing yes back to no.
  marketing_consent: z.boolean().optional(),
  coupon_code: z.string().min(1).max(40).optional(),
  applied_bundle_ids: z.array(z.string().uuid()).max(10).optional(),
  // Set by the kiosk app. Bypasses the "auth or guest phone" gate after
  // we verify the tenant actually has kioskEnabled=true on the server.
  // Kiosk orders are anonymous pickups paid via QR (or at the counter).
  kiosk: z.boolean().optional(),
  lines: z
    .array(
      z.object({
        item_id: z.string().uuid(),
        quantity: z.number().int().min(1).max(20),
        size_id: z.string().uuid().nullable().optional(),
        option_ids: z.array(z.string().uuid()).default([]),
        option_placements: z.record(z.string().uuid(), z.enum(["left", "right", "full"])).optional(),
        notes: z.string().max(200).nullable().optional(),
        source: z.enum(["menu", "ai_advisor", "upsell", "reorder"]).default("menu"),
      }),
    )
    .min(1),
});

export const POST = handler(async (req: Request) => {
  const body = CreateOrderSchema.parse(await req.json());
  const session = await getSession();

  // Anyone may place an order: a logged-in customer attaches their
  // userId; everyone else (guests, merchants browsing their own store
  // for QA, admins testing) places as a guest and must hand over a
  // phone number. The previous "customer-only" gate was over-strict
  // and blocked merchants who navigated into their storefront.
  const isCustomerSession = session?.type === "customer";
  let kioskAuthorized = false;
  if (body.kiosk) {
    const t = await prisma.tenant.findUnique({
      where: { slug: body.tenant_slug },
      select: { kioskEnabled: true },
    });
    if (!t?.kioskEnabled) {
      return apiError("kiosk_disabled", "מצב קיוסק לא פעיל למסעדה זו", 403);
    }
    kioskAuthorized = true;
  }
  if (!isCustomerSession && !body.guest_phone && !kioskAuthorized) {
    return apiError("auth_required", "נדרשת התחברות או טלפון אורח", 401);
  }

  let guestPhone: string | undefined;
  if (body.guest_phone) {
    const normalized = toE164(body.guest_phone);
    if (!normalized) {
      return apiError(
        "invalid_phone",
        "מספר הטלפון אינו תקין. דוגמה: 050-1234567",
        422,
        "guest_phone",
      );
    }
    guestPhone = normalized;
  }

  try {
    const result = await createOrder({
      tenantSlug: body.tenant_slug,
      customerId: isCustomerSession ? session.userId : undefined,
      guestPhone,
      guestFirstName: body.guest_first_name,
      guestLastName: body.guest_last_name,
      customerEmail: body.customer_email,
      marketingConsent: body.marketing_consent,
      method: body.method,
      addressId: body.address_id ?? null,
      deliveryNotes: body.delivery_notes ?? null,
      customerNotes: body.customer_notes ?? null,
      paymentMethod: body.payment_method,
      tip: body.tip,
      cutleryCount: body.cutlery_count,
      scheduledFor: body.scheduled_for ? new Date(body.scheduled_for) : null,
      couponCode: body.coupon_code ?? null,
      appliedBundleIds: body.applied_bundle_ids,
      kiosk: kioskAuthorized,
      lines: body.lines.map((l) => ({
        item_id: l.item_id,
        quantity: l.quantity,
        size_id: l.size_id ?? undefined,
        option_ids: l.option_ids,
        option_placements: l.option_placements,
        notes: l.notes ?? undefined,
        source: l.source,
      })),
    });

    const needsPayment = result.paymentMethod !== "cash";

    // Fold the payment initiation into this same request for card orders so
    // the client skips a second round-trip (second network hop + possible
    // cold start) — that's the bulk of the click-to-wallet latency. This is
    // best-effort: any failure leaves `payment` null and the client falls
    // back to POST /pay/initiate, so it can never block order creation.
    // Kiosk orders pay later via the QR pay page (which initiates on its
    // own), so we only fold initiation in for the regular checkout flow.
    let payment: InitiatePaymentData | null = null;
    if (needsPayment && !kioskAuthorized) {
      try {
        const init = await initiateOrderPayment(result.order.id);
        if (init.ok) payment = init.data;
      } catch {
        /* fall back to /pay/initiate on the client */
      }
    }

    return apiJson(
      {
        order: {
          id: result.order.id,
          number: result.order.number,
          status: result.order.status,
          total: result.total,
          payment_method: result.paymentMethod,
          payment_status: result.order.paymentStatus,
        },
        // HMAC token the client persists alongside the orderId. Used as
        // proof-of-ownership for the review form when the customer doesn't
        // have an OTP session (same-device return visit, or click from the
        // review-reminder email).
        review_token: signReviewToken(result.order.id),
        // For card payments, client should now call /pay/initiate — unless
        // `payment` below is already populated (inline fast path).
        needs_payment: needsPayment,
        // Inline initiation result (null if it failed or wasn't needed).
        payment,
      },
      201,
    );
  } catch (err) {
    if (err instanceof CartValidationError) {
      const httpCode = err.code === "min_order_not_met" || err.code === "restaurant_closed" ? 409 : 422;
      return apiError(err.code, errorMessageFor(err.code), httpCode, err.field);
    }
    throw err;
  }
});

export const GET = handler(async () => {
  const session = await getSession();
  if (!session || session.type !== "customer") {
    return apiError("unauthorized", "נדרשת התחברות", 401);
  }
  const orders = await prisma.order.findMany({
    where: { customerId: session.userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      items: { select: { id: true, nameSnapshot: true, quantity: true, totalPrice: true } },
      tenant: { select: { slug: true, name: true, themeId: true } },
    },
  });
  return apiJson({
    orders: orders.map((o) => ({
      id: o.id,
      number: o.number,
      status: o.status,
      method: o.method,
      total: o.total,
      created_at: o.createdAt.toISOString(),
      tenant: o.tenant,
      items: o.items.map((it) => ({
        id: it.id,
        name: it.nameSnapshot,
        quantity: it.quantity,
        total: it.totalPrice,
      })),
    })),
  });
});

function errorMessageFor(code: string): string {
  const m: Record<string, string> = {
    tenant_not_found: "המסעדה לא נמצאה",
    tenant_inactive: "המסעדה לא פעילה",
    no_branch: "אין סניף פעיל",
    restaurant_closed: "המסעדה סגורה כרגע",
    cart_empty: "הסל ריק",
    item_unavailable: "פריט לא זמין",
    invalid_quantity: "כמות לא תקינה",
    size_not_found: "גודל לא נמצא",
    required_group_missing: "חובה לבחור באחת האפשרויות",
    too_many_in_single_group: "ניתן לבחור רק אפשרות אחת",
    too_many_in_group: "חרגת מהמספר המקסימלי של בחירות",
    address_required: "נדרשת כתובת למשלוח",
    address_not_found: "הכתובת לא נמצאה",
    min_order_not_met: "לא הגעת לסכום מינימום להזמנה",
  };
  return m[code] ?? code;
}
