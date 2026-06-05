import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { createOrder, CartValidationError } from "@/lib/orders-create";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SaleSchema = z.object({
  shift_id: z.string().uuid(),
  customer_id: z.string().uuid().nullable().optional(),
  notes: z.string().max(500).optional(),
  payment_method: z.enum(["cash", "card"]).default("cash"),
  // Walk-in details collected by the cashier when no Customer row is
  // attached. Used as the order snapshot so Grow PROD wallets accept
  // the auth code (placeholder "Customer" gets rejected).
  guest_name: z.string().min(2).max(60).optional(),
  guest_phone: z.string().min(7).max(20).optional(),
  /** Cashier-applied discount in whole shekels (already computed
   *  client-side from either a % or fixed-₪ choice). Server re-validates
   *  by capping at subtotal in createOrder. */
  manual_discount: z.number().int().min(0).max(99_999).optional(),
  /** Cashier-applied tip in whole shekels. Goes straight to Order.tip
   *  and is added to the final total by createOrder. */
  tip: z.number().int().min(0).max(99_999).optional(),
  lines: z
    .array(
      z.object({
        item_id: z.string().uuid(),
        quantity: z.number().int().min(1).max(20),
        size_id: z.string().uuid().nullable().optional(),
        option_ids: z.array(z.string().uuid()).default([]),
        option_placements: z
          .record(z.string().uuid(), z.enum(["left", "right", "full"]))
          .optional(),
        notes: z.string().max(200).nullable().optional(),
      }),
    )
    .min(1),
});

/**
 * POS register sale — same line-item shape as the customer storefront,
 * but `source = pos` + `paymentMethod = cash` (settled by the payment
 * sheet after creation), and tagged with `cashierId + posShiftId` for
 * day-end reporting.
 */
export const POST = handler(async (req: Request) => {
  const session = await requireMerchant(["cashier", "owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const body = SaleSchema.parse(await req.json());

  const shift = await prisma.posShift.findFirst({
    where: { id: body.shift_id, cashierId: session.userId, closedAt: null },
    select: { id: true, branchId: true },
  });
  if (!shift) return apiError("no_open_shift", "אין משמרת פתוחה תואמת", 404);

  const [tenant, branch] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: session.tenantId },
      select: { slug: true, name: true },
    }),
    prisma.branch.findUnique({
      where: { id: shift.branchId },
      select: { phone: true, email: true },
    }),
  ]);
  if (!tenant) return apiError("not_found", "tenant", 404);

  let customerPhone: string | undefined;
  let customerFirstName: string | undefined;
  let customerLastName: string | undefined;
  let customerEmail: string | undefined;
  if (body.customer_id) {
    const c = await prisma.customer.findUnique({
      where: { id: body.customer_id },
      select: { phone: true, firstName: true, lastName: true, email: true },
    });
    if (c) {
      customerPhone = c.phone;
      customerFirstName = c.firstName;
      customerLastName = c.lastName;
      customerEmail = c.email ?? undefined;
    }
  }
  // Walk-in details from the cashier (only present when the operator
  // filled them in — required for card payments, optional for cash).
  if (!customerFirstName && body.guest_name) {
    // Grow PROD requires fullName to have at least two tokens; the wire-
    // side helper adds a "." anyway, but splitting on the first space is
    // friendlier for invoices.
    const [first, ...rest] = body.guest_name.trim().split(/\s+/);
    customerFirstName = first;
    if (rest.length > 0) customerLastName = rest.join(" ");
  }
  if (!customerPhone && body.guest_phone) customerPhone = body.guest_phone;
  // Last resort — merchant fallbacks so the wallet doesn't reject on
  // empty fields. Cash flow ignores this since Grow isn't called.
  if (!customerPhone && branch?.phone) customerPhone = branch.phone;
  if (!customerFirstName) customerFirstName = tenant.name;
  if (!customerLastName) customerLastName = "(קופה)";
  if (!customerEmail && branch?.email) customerEmail = branch.email;

  try {
    const result = await createOrder({
      tenantSlug: tenant.slug,
      customerId: body.customer_id ?? undefined,
      guestPhone: customerPhone,
      guestFirstName: customerFirstName,
      guestLastName: customerLastName,
      customerEmail,
      // Don't auto-create a Customer row for an unattached POS walk-in:
      // the snapshot phone/name above is the merchant's fallback so Grow
      // accepts the wallet, not real customer data.
      linkGuestCustomer: !!body.customer_id,
      method: "pickup",
      customerNotes: body.notes ?? null,
      paymentMethod: body.payment_method,
      manualDiscount: body.manual_discount,
      tip: body.tip,
      kiosk: true, // bypass minOrder — counter sale, not delivery
      sourceOverride: "pos",
      cashierId: session.userId,
      posShiftId: shift.id,
      lines: body.lines.map((l) => ({
        item_id: l.item_id,
        quantity: l.quantity,
        size_id: l.size_id ?? undefined,
        option_ids: l.option_ids,
        option_placements: l.option_placements,
        notes: l.notes ?? undefined,
        source: "menu",
      })),
    });

    return apiJson(
      { order: { id: result.order.id, number: result.order.number, total: result.total } },
      201,
    );
  } catch (err) {
    if (err instanceof CartValidationError) {
      return apiError(err.code, err.code, 422, err.field);
    }
    throw err;
  }
});
