import { handler, apiJson, apiError } from "@/lib/api-response";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { serializeSelectedOptions } from "@/lib/orders-serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function maskPhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return null;
  // 050-***-**67 - leaks the prefix (so the customer recognizes it)
  // and the last two digits (enough to confirm "yes that's mine").
  const prefix = digits.startsWith("972") ? `0${digits.slice(3, 5)}` : digits.slice(0, 3);
  return `${prefix}-***-**${digits.slice(-2)}`;
}

function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const [local, domain] = email.split("@");
  if (!local || !domain) return null;
  const head = local.length <= 2 ? `${local[0] ?? ""}` : local.slice(0, 2);
  return `${head}***@${domain}`;
}

export const GET = handler(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: true,
      tenant: { select: { id: true, slug: true, name: true, themeId: true, logoLetter: true } },
      branch: { select: { name: true, address: true, phone: true } },
      deliveryAddress: true,
      customer: { select: { firstName: true, lastName: true, phone: true } },
      courier: {
        select: {
          id: true,
          name: true,
          phone: true,
          ratingAvg: true,
          currentLat: true,
          currentLng: true,
          lastSeenAt: true,
        },
      },
    },
  });
  if (!order) return apiError("not_found", "הזמנה לא נמצאה", 404);

  // Visibility: owner customer or guest with matching phone - for MVP, any
  // logged-in customer can view their own; guest orders are public-by-id
  // (UUIDv4 is unguessable enough for MVP).
  const session = await getSession();
  if (session?.type === "customer" && order.customerId && order.customerId !== session.userId) {
    return apiError("forbidden", "אין הרשאה לצפות בהזמנה זו", 403);
  }

  return apiJson({
    order: {
      id: order.id,
      number: order.number,
      status: order.status,
      method: order.method,
      subtotal: order.subtotal,
      delivery_fee: order.deliveryFee,
      service_fee: order.serviceFee,
      cutlery_fee: order.cutleryFee,
      cutlery_count: order.cutleryCount,
      tip: order.tip,
      discount: order.discount,
      total: order.total,
      payment_method: order.paymentMethod,
      payment_status: order.paymentStatus,
      invoice_number: order.invoiceNumber,
      invoice_url: order.invoiceUrl,
      // Masked contact info so the PayPage can say "we'll SMS you at
      // ***-***-XX67" without leaking the full number to anyone who
      // happens to know the UUID. Empty when nothing was captured.
      customer_phone_masked: maskPhone(order.customerPhoneSnap),
      customer_email_masked: maskEmail(order.customerEmailSnap),
      customer_notes: order.customerNotes,
      delivery_notes: order.deliveryNotes,
      created_at: order.createdAt.toISOString(),
      confirmed_at: order.confirmedAt?.toISOString() ?? null,
      preparing_at: order.preparingAt?.toISOString() ?? null,
      ready_at: order.readyAt?.toISOString() ?? null,
      delivered_at: order.deliveredAt?.toISOString() ?? null,
      estimated_ready_at: order.estimatedReadyAt?.toISOString() ?? null,
      estimated_delivery_at: order.estimatedDeliveryAt?.toISOString() ?? null,
      tenant: order.tenant,
      branch: order.branch,
      delivery_address: order.deliveryAddress,
      // Customer block: prefer the live Customer row when present
      // (logged-in customer's account), otherwise fall back to the
      // snapshot fields stored on the order at creation time -
      // manual / guest orders never get a Customer row but always
      // have customerPhoneSnap + customerFirstNameSnap.
      customer: {
        name:
          [order.customer?.firstName, order.customer?.lastName]
            .filter(Boolean)
            .join(" ")
            .trim() ||
          [order.customerFirstNameSnap, order.customerLastNameSnap]
            .filter(Boolean)
            .join(" ")
            .trim() ||
          null,
        phone: order.customer?.phone ?? order.customerPhoneSnap ?? null,
      },
      courier: order.courier
        ? {
            id: order.courier.id,
            name: order.courier.name,
            phone: order.courier.phone,
            rating_avg: Number(order.courier.ratingAvg),
            lat:
              (order.status === "out_for_delivery" || order.status === "ready") &&
              order.courier.currentLat
                ? Number(order.courier.currentLat)
                : null,
            lng:
              (order.status === "out_for_delivery" || order.status === "ready") &&
              order.courier.currentLng
                ? Number(order.courier.currentLng)
                : null,
            last_seen_at: order.courier.lastSeenAt?.toISOString() ?? null,
          }
        : null,
      items: order.items.map((it) => ({
        id: it.id,
        name: it.nameSnapshot,
        quantity: it.quantity,
        unit_price: it.unitPrice,
        total_price: it.totalPrice,
        size: it.sizeSnapshot,
        options: serializeSelectedOptions(it.selectedOptions),
        notes: it.notes,
      })),
    },
  });
});
