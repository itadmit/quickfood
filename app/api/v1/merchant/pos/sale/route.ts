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

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: { slug: true },
  });
  if (!tenant) return apiError("not_found", "tenant", 404);

  let customerPhone: string | undefined;
  let customerFirstName: string | undefined;
  let customerLastName: string | undefined;
  if (body.customer_id) {
    const c = await prisma.customer.findUnique({
      where: { id: body.customer_id },
      select: { phone: true, firstName: true, lastName: true },
    });
    if (c) {
      customerPhone = c.phone;
      customerFirstName = c.firstName;
      customerLastName = c.lastName;
    }
  }

  try {
    const result = await createOrder({
      tenantSlug: tenant.slug,
      customerId: body.customer_id ?? undefined,
      guestPhone: customerPhone,
      guestFirstName: customerFirstName,
      guestLastName: customerLastName,
      method: "pickup",
      customerNotes: body.notes ?? null,
      paymentMethod: body.payment_method,
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
