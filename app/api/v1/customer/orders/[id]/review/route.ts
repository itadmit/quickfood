import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { verifyReviewToken } from "@/lib/reviews/token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  text: z.string().trim().max(1000).optional().nullable(),
  // Optional per-item ratings. Keys are OrderItem ids - only items belonging
  // to this order are accepted; others are silently ignored.
  items: z
    .array(
      z.object({
        order_item_id: z.string().uuid(),
        rating: z.number().int().min(1).max(5),
        text: z.string().trim().max(500).optional().nullable(),
      }),
    )
    .max(50)
    .optional(),
});

export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  const { id } = await params;

  const url = new URL(req.url);
  const rawToken = url.searchParams.get("t");
  const tokenDecoded = verifyReviewToken(rawToken);
  const tokenMatches = !!tokenDecoded && tokenDecoded.orderId === id;

  const sessionMatchesCustomer =
    !!session && session.type === "customer";

  if (!tokenMatches && !sessionMatchesCustomer) {
    return apiError("unauthorized", "יש להתחבר כדי להשאיר ביקורת", 401);
  }

  const body = ReviewSchema.parse(await req.json());

  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      tenantId: true,
      customerId: true,
      status: true,
      items: { select: { id: true, menuItemId: true } },
    },
  });
  if (!order) return apiError("not_found", "הזמנה לא נמצאה", 404);

  // Authorization: either the cookie session belongs to the order's
  // customer, or the request carried a valid signed token for this order.
  // Reviews still require a non-null customerId (Review.customerId is
  // required by the schema) - which is now true for every phone-checkout
  // order since we upsert the customer in orders-create.ts.
  if (!order.customerId) {
    return apiError("forbidden", "לא ניתן לדרג הזמנה ללא לקוח", 403);
  }
  const sessionOwns = sessionMatchesCustomer && session!.userId === order.customerId;
  if (!sessionOwns && !tokenMatches) {
    return apiError("forbidden", "אין הרשאה לכתוב ביקורת על הזמנה זו", 403);
  }

  // Only completed orders are reviewable.
  if (order.status !== "delivered") {
    return apiError("invalid_state", "ניתן לדרג רק לאחר השלמת ההזמנה", 409);
  }

  // Confirm the tenant hasn't disabled reviews.
  const tenant = await prisma.tenant.findUnique({
    where: { id: order.tenantId },
    select: { reviewsEnabled: true },
  });
  if (!tenant?.reviewsEnabled) {
    return apiError("invalid_state", "ביקורות מושבתות במסעדה זו", 409);
  }

  // orderId is unique on Review - one review per order. Use upsert-style
  // guard with a friendly error rather than letting Prisma throw P2002.
  const existing = await prisma.review.findUnique({
    where: { orderId: order.id },
    select: { id: true },
  });
  if (existing) {
    return apiError("already_reviewed", "כבר נתת דירוג להזמנה זו", 409);
  }

  const text = body.text?.trim() ? body.text.trim() : null;

  // Map provided per-item ratings to valid OrderItem ids on this order.
  // Anything else (typos, ids from other orders) is silently dropped.
  const orderItemsById = new Map(order.items.map((it) => [it.id, it]));
  const validItems =
    body.items?.flatMap((it) => {
      const orderItem = orderItemsById.get(it.order_item_id);
      if (!orderItem) return [];
      return [
        {
          orderItemId: orderItem.id,
          menuItemId: orderItem.menuItemId,
          rating: it.rating,
          text: it.text?.trim() ? it.text.trim() : null,
        },
      ];
    }) ?? [];

  const review = await prisma.review.create({
    data: {
      tenantId: order.tenantId,
      orderId: order.id,
      customerId: order.customerId,
      rating: body.rating,
      text,
      items: validItems.length
        ? {
            createMany: {
              data: validItems.map((it) => ({
                orderItemId: it.orderItemId,
                menuItemId: it.menuItemId ?? null,
                rating: it.rating,
                text: it.text,
              })),
            },
          }
        : undefined,
    },
    select: {
      id: true,
      rating: true,
      text: true,
      replyText: true,
      replyAt: true,
      createdAt: true,
      items: {
        select: {
          id: true,
          orderItemId: true,
          menuItemId: true,
          rating: true,
          text: true,
        },
      },
    },
  });

  return apiJson(
    {
      review: {
        id: review.id,
        rating: review.rating,
        text: review.text,
        reply_text: review.replyText,
        reply_at: review.replyAt?.toISOString() ?? null,
        created_at: review.createdAt.toISOString(),
        items: review.items.map((it) => ({
          id: it.id,
          order_item_id: it.orderItemId,
          menu_item_id: it.menuItemId,
          rating: it.rating,
          text: it.text,
        })),
      },
    },
    201,
  );
});
