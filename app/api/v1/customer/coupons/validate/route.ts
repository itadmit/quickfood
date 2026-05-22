import { handler, apiJson, apiError } from "@/lib/api-response";
import { prisma } from "@/lib/db/client";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ValidateSchema = z.object({
  tenant_slug: z.string().min(1).max(80),
  code: z.string().min(1).max(40),
  subtotal: z.number().int().min(0),
});

/**
 * POST /api/v1/customer/coupons/validate
 *
 * Public endpoint (no session required) — the customer is checking a code
 * BEFORE they've registered/signed-in. Server returns the computed discount
 * amount in agorot/shekels (matches the integer-shekel money convention used
 * everywhere else in the app).
 *
 * NOT a usage increment. The real apply-and-decrement happens in
 * orders-create.ts when the order is placed; this endpoint is just for the
 * live preview during checkout.
 *
 * Failure modes are all 200 with `{ valid: false, message }` so the
 * customer-facing UI can render the reason inline without a network-error
 * banner; only programming errors are 4xx/5xx.
 */
export const POST = handler(async (req: Request) => {
  const body = ValidateSchema.parse(await req.json());

  const tenant = await prisma.tenant.findUnique({
    where: { slug: body.tenant_slug },
    select: { id: true, status: true },
  });
  if (!tenant || tenant.status !== "active") {
    return apiError("not_found", "מסעדה לא נמצאה", 404);
  }

  const code = body.code.trim().toUpperCase();
  const coupon = await prisma.coupon.findFirst({
    where: { tenantId: tenant.id, code },
    select: {
      id: true,
      type: true,
      value: true,
      minOrder: true,
      maxDiscount: true,
      usageLimit: true,
      usageCount: true,
      validFrom: true,
      validUntil: true,
      active: true,
    },
  });

  if (!coupon) {
    return apiJson({ valid: false, message: "קוד הקופון לא קיים" });
  }
  if (!coupon.active) {
    return apiJson({ valid: false, message: "הקופון כבר לא פעיל" });
  }
  const now = new Date();
  if (coupon.validFrom && now < coupon.validFrom) {
    return apiJson({ valid: false, message: "הקופון עוד לא תקף" });
  }
  if (coupon.validUntil && now > coupon.validUntil) {
    return apiJson({ valid: false, message: "הקופון פג תוקף" });
  }
  if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) {
    return apiJson({ valid: false, message: "הקופון מוצה" });
  }
  if (coupon.minOrder !== null && body.subtotal < coupon.minOrder) {
    return apiJson({
      valid: false,
      message: `הקופון בתוקף מהזמנות של ₪${coupon.minOrder} ומעלה`,
    });
  }

  // Compute the discount in integer shekels. Round DOWN so we never over-discount.
  let discount =
    coupon.type === "percent"
      ? Math.floor((body.subtotal * coupon.value) / 100)
      : coupon.value;
  if (coupon.maxDiscount !== null && discount > coupon.maxDiscount) {
    discount = coupon.maxDiscount;
  }
  // Never let the discount exceed the subtotal — clamp at the line.
  if (discount > body.subtotal) discount = body.subtotal;

  return apiJson({
    valid: true,
    discount,
    type: coupon.type,
    value: coupon.value,
    message:
      coupon.type === "percent"
        ? `${coupon.value}% הנחה`
        : `הנחה של ₪${coupon.value}`,
  });
});
