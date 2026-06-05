import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ManualSaleSchema = z.object({
  amount: z.number().int().min(1).max(1_000_000),
  shift_id: z.string().uuid(),
  customer_id: z.string().uuid().nullable().optional(),
  notes: z.string().max(500).optional(),
  // Cashier picks cash/card in the payment sheet before the order is
  // created. Defaults to cash so pre-payment-sheet callers keep working.
  payment_method: z.enum(["cash", "card"]).default("cash"),
  // Walk-in details - required for card (Grow PROD), optional for cash.
  guest_name: z.string().min(2).max(60).optional(),
  guest_phone: z.string().min(7).max(20).optional(),
});

/**
 * Create a one-line POS order with a free-text "תשלום ידני" snapshot -
 * no menu item attached. Status starts as `pending` + `paymentStatus`
 * pending; the cashier finalizes via `cash-collected` or the Grow wallet
 * callback (card). We don't preset paymentMethod here - the payment sheet
 * picks it after creation.
 */
export const POST = handler(async (req: Request) => {
  const session = await requireMerchant(["cashier", "owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const body = ManualSaleSchema.parse(await req.json());

  const shift = await prisma.posShift.findFirst({
    where: { id: body.shift_id, cashierId: session.userId, closedAt: null },
    select: { id: true, branchId: true },
  });
  if (!shift) return apiError("no_open_shift", "אין משמרת פתוחה תואמת", 404);

  // Snapshot the customer (if attached) or fall back to the tenant's
  // own contact info - Grow's production validator rejects placeholder
  // names ("Customer ."), placeholder phones ("0500000000"), and empty
  // emails, even when the wallet would otherwise succeed.
  const [counterTenant, branch, customer] = await Promise.all([
    prisma.tenant.update({
      where: { id: session.tenantId },
      data: { nextOrderNumber: { increment: 1 } },
      select: { nextOrderNumber: true, slug: true, name: true },
    }),
    prisma.branch.findUnique({
      where: { id: shift.branchId },
      select: { phone: true, email: true },
    }),
    body.customer_id
      ? prisma.customer.findUnique({
          where: { id: body.customer_id },
          select: { phone: true, firstName: true, lastName: true, email: true },
        })
      : Promise.resolve(null),
  ]);
  const orderSeq = counterTenant.nextOrderNumber - 1;
  const prefix =
    counterTenant.slug
      .split("-")
      .map((s) => s[0])
      .join("")
      .toUpperCase()
      .slice(0, 3) || "QF";
  const number = `${prefix}-${orderSeq}`;

  // Walk-in details from the cashier override the merchant fallback
  // (which is only there for the wallet to accept the auth code at all).
  let walkInFirst: string | undefined;
  let walkInLast: string | undefined;
  if (body.guest_name) {
    const [first, ...rest] = body.guest_name.trim().split(/\s+/);
    walkInFirst = first;
    walkInLast = rest.length > 0 ? rest.join(" ") : undefined;
  }
  const customerPhoneSnap =
    customer?.phone ?? body.guest_phone ?? branch?.phone ?? null;
  const customerFirstNameSnap =
    customer?.firstName ?? walkInFirst ?? counterTenant.name;
  const customerLastNameSnap =
    customer?.lastName ?? walkInLast ?? "(קופה)";
  const customerEmailSnap = customer?.email ?? branch?.email ?? null;

  const order = await prisma.order.create({
    data: {
      number,
      tenantId: session.tenantId,
      branchId: shift.branchId,
      customerId: body.customer_id ?? null,
      status: "pending",
      method: "pickup",
      source: "pos",
      paymentMethod: body.payment_method,
      paymentStatus: "pending",
      subtotal: body.amount,
      total: body.amount,
      customerNotes: body.notes ?? null,
      customerPhoneSnap,
      customerFirstNameSnap,
      customerLastNameSnap,
      customerEmailSnap,
      cashierId: session.userId,
      posShiftId: shift.id,
      items: {
        create: [
          {
            menuItemId: null,
            nameSnapshot: "תשלום ידני",
            quantity: 1,
            unitPrice: body.amount,
            totalPrice: body.amount,
            source: "menu",
          },
        ],
      },
    },
    select: { id: true, number: true, total: true },
  });

  // Mirror createOrder()'s "created" event so SSE / analytics see a
  // consistent trail for every order regardless of which surface rang it.
  await prisma.orderEvent.create({
    data: {
      orderId: order.id,
      type: "created",
      payload: { status: "pending", total: order.total, source: "pos" },
    },
  });

  return apiJson({ order }, 201);
});
