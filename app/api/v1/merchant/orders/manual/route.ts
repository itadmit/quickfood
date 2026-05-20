import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { createOrder, CartValidationError } from "@/lib/orders-create";
import { toE164 } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ManualSchema = z.object({
  customer_phone: z.string().min(7).max(20),
  customer_name: z.string().min(1).max(80),
  method: z.enum(["delivery", "pickup"]).default("pickup"),
  address: z.string().max(200).optional(),
  payment_method: z.enum(["cash", "card"]).default("cash"),
  notes: z.string().max(500).optional(),
  lines: z
    .array(
      z.object({
        item_id: z.string().uuid(),
        quantity: z.number().int().min(1).max(20),
        size_id: z.string().uuid().nullable().optional(),
        option_ids: z.array(z.string().uuid()).default([]),
      }),
    )
    .min(1),
});

export const POST = handler(async (req: Request) => {
  const session = await requireMerchant();
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);

  const body = ManualSchema.parse(await req.json());
  const phone = toE164(body.customer_phone);
  if (!phone) return apiError("validation_error", "טלפון לא תקין", 422, "customer_phone");

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: { slug: true },
  });
  if (!tenant) return apiError("not_found", "tenant not found", 404);

  try {
    // Merchant manual entry still takes one "customer name" field;
    // split on the first space to match the new firstName/lastName
    // schema. Trailing tokens collapse into lastName.
    const trimmed = body.customer_name.trim();
    const spaceAt = trimmed.indexOf(" ");
    const customerFirstName =
      spaceAt > 0 ? trimmed.slice(0, spaceAt) : trimmed;
    const customerLastName =
      spaceAt > 0 ? trimmed.slice(spaceAt + 1).trim() : "";

    const result = await createOrder({
      tenantSlug: tenant.slug,
      guestPhone: phone,
      guestFirstName: customerFirstName || undefined,
      guestLastName: customerLastName || undefined,
      method: body.method,
      addressId: null,
      deliveryNotes: body.address ?? null,
      customerNotes: body.notes ?? null,
      paymentMethod: body.payment_method,
      lines: body.lines.map((l) => ({
        item_id: l.item_id,
        quantity: l.quantity,
        size_id: l.size_id ?? undefined,
        option_ids: l.option_ids,
      })),
    });
    return apiJson(
      {
        order: {
          id: result.order.id,
          number: result.order.number,
          status: result.order.status,
          total: result.total,
        },
      },
      201,
    );
  } catch (err) {
    if (err instanceof CartValidationError) {
      return apiError(err.code, err.code, 422);
    }
    throw err;
  }
});
