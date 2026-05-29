import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { dispatchWebhook } from "@/lib/webhooks/dispatcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EDITABLE_STATUSES = new Set(["pending", "confirmed", "preparing", "in_oven", "ready"]);

const Body = z.object({
  address: z
    .object({
      street: z.string().min(1).max(200).optional(),
      city: z.string().min(1).max(120).optional(),
      apartment: z.string().max(40).nullable().optional(),
      floor: z.string().max(40).nullable().optional(),
      entrance: z.string().max(40).nullable().optional(),
      notes: z.string().max(500).nullable().optional(),
    })
    .optional(),
  customer_notes: z.string().max(500).nullable().optional(),
  delivery_notes: z.string().max(500).nullable().optional(),
});

export const PATCH = handler(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireMerchant(["owner", "manager"]);
    if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
    const { id } = await params;
    const body = Body.parse(await req.json());

    const order = await prisma.order.findFirst({
      where: { id, tenantId: session.tenantId },
      select: {
        id: true,
        tenantId: true,
        status: true,
        deliveryAddressId: true,
      },
    });
    if (!order) return apiError("not_found", "הזמנה לא נמצאה", 404);
    if (!EDITABLE_STATUSES.has(order.status)) {
      return apiError(
        "not_editable",
        "אי אפשר לערוך הזמנה אחרי שיצאה למשלוח / נמסרה / בוטלה",
        409,
      );
    }

    const orderUpdate: Record<string, unknown> = {};
    if (body.customer_notes !== undefined) orderUpdate.customerNotes = body.customer_notes;
    if (body.delivery_notes !== undefined) orderUpdate.deliveryNotes = body.delivery_notes;

    const addrChanges = body.address;
    const hasAddrChange = addrChanges && Object.keys(addrChanges).length > 0;
    if (hasAddrChange && !order.deliveryAddressId) {
      // Guest order — no structured Address row to mutate. The
      // address-as-typed lives in deliveryNotes; merge the structured
      // fields into a single line so the courier still sees it.
      const line = [
        addrChanges.street,
        addrChanges.city,
        addrChanges.apartment && `דירה ${addrChanges.apartment}`,
        addrChanges.floor && `קומה ${addrChanges.floor}`,
        addrChanges.entrance && `כניסה ${addrChanges.entrance}`,
        addrChanges.notes,
      ]
        .filter(Boolean)
        .join(", ");
      if (line) orderUpdate.deliveryNotes = line;
    }

    await prisma.$transaction(async (tx) => {
      if (hasAddrChange && order.deliveryAddressId) {
        await tx.address.update({
          where: { id: order.deliveryAddressId },
          data: {
            ...(addrChanges.street !== undefined ? { street: addrChanges.street } : {}),
            ...(addrChanges.city !== undefined ? { city: addrChanges.city } : {}),
            ...(addrChanges.apartment !== undefined ? { apartment: addrChanges.apartment } : {}),
            ...(addrChanges.floor !== undefined ? { floor: addrChanges.floor } : {}),
            ...(addrChanges.entrance !== undefined ? { entrance: addrChanges.entrance } : {}),
            ...(addrChanges.notes !== undefined ? { notes: addrChanges.notes } : {}),
            // Clear lat/lng — the old geocode no longer matches the
            // new street. The courier's Waze fallback re-geocodes
            // from the text address.
            lat: null,
            lng: null,
          },
        });
      }
      if (Object.keys(orderUpdate).length > 0) {
        await tx.order.update({ where: { id }, data: orderUpdate });
      }
      await tx.orderEvent.create({
        data: {
          orderId: id,
          type: "details_edited",
          payload: {
            edited_by: session.userId,
            address_changed: !!hasAddrChange,
            customer_notes_changed: body.customer_notes !== undefined,
            delivery_notes_changed: body.delivery_notes !== undefined,
          } as unknown as Prisma.InputJsonValue,
        },
      });
    });

    void dispatchWebhook({
      tenantId: order.tenantId,
      eventType: "order.details_edited",
      payload: { order_id: id },
    });

    return apiJson({ ok: true });
  },
);
