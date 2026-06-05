import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { prisma } from "@/lib/db/client";
import { createKioskCheckout } from "@/lib/orders/kiosk-checkout";
import { createOrder, CartValidationError } from "@/lib/orders-create";
import { toE164 } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CreateCheckoutSchema = z.object({
  tenant_slug: z.string().min(1),
  method: z.enum(["delivery", "pickup"]).default("pickup"),
  customer_notes: z.string().max(500).optional(),
  payment_method: z.enum(["card", "apple_pay", "google_pay", "bit", "cash"]).default("card"),
  guest_phone: z.string().optional(),
  guest_first_name: z.string().min(1).max(40).optional(),
  guest_last_name: z.string().max(40).optional(),
  customer_email: z.string().email().optional(),
  marketing_consent: z.boolean().optional(),
  applied_bundle_ids: z.array(z.string().uuid()).max(10).optional(),
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
  const body = CreateCheckoutSchema.parse(await req.json());

  const t = await prisma.tenant.findUnique({
    where: { slug: body.tenant_slug },
    select: { kioskEnabled: true },
  });
  if (!t?.kioskEnabled) {
    return apiError("kiosk_disabled", "מצב קיוסק לא פעיל למסעדה זו", 403);
  }

  let guestPhone: string | undefined;
  if (body.guest_phone) {
    const normalized = toE164(body.guest_phone);
    if (!normalized) {
      return apiError("invalid_phone", "מספר הטלפון אינו תקין", 422, "guest_phone");
    }
    guestPhone = normalized;
  }

  const lines = body.lines.map((l) => ({
    item_id: l.item_id,
    quantity: l.quantity,
    size_id: l.size_id ?? undefined,
    option_ids: l.option_ids,
    option_placements: l.option_placements,
    notes: l.notes ?? undefined,
    source: l.source,
  }));

  // Cash-at-kiosk skips the Grow checkout intermediate - the customer
  // walks the order number to the counter and the cashier collects it
  // from the POS queue. We materialize a real Order immediately,
  // status=pending + paymentStatus=pending + source=kiosk.
  if (body.payment_method === "cash") {
    try {
      const result = await createOrder({
        tenantSlug: body.tenant_slug,
        guestPhone,
        guestFirstName: body.guest_first_name,
        guestLastName: body.guest_last_name,
        customerEmail: body.customer_email,
        marketingConsent: body.marketing_consent,
        method: body.method,
        customerNotes: body.customer_notes ?? null,
        paymentMethod: "cash",
        appliedBundleIds: body.applied_bundle_ids,
        kiosk: true,
        sourceOverride: "kiosk",
        lines,
      });
      return apiJson(
        {
          order: {
            id: result.order.id,
            number: result.order.number,
            total: result.total,
          },
        },
        201,
      );
    } catch (err) {
      if (err instanceof CartValidationError) {
        return apiError(err.code, err.code, 422, err.field);
      }
      throw err;
    }
  }

  const result = await createKioskCheckout({
    tenantSlug: body.tenant_slug,
    guestPhone,
    guestFirstName: body.guest_first_name,
    guestLastName: body.guest_last_name,
    customerEmail: body.customer_email,
    marketingConsent: body.marketing_consent,
    method: body.method,
    customerNotes: body.customer_notes ?? null,
    paymentMethod: body.payment_method,
    appliedBundleIds: body.applied_bundle_ids,
    kiosk: true,
    lines,
  });

  if (!result.ok) {
    const status = result.code === "kiosk_disabled" ? 403 : 422;
    return apiError(result.code, result.code, status, result.field);
  }

  return apiJson(
    {
      checkout: {
        id: result.checkoutId,
        amount: result.amount,
        expires_at: result.expiresAt.toISOString(),
      },
    },
    201,
  );
});
