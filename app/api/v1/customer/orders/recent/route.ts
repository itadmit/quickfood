import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { resolveTenantBySlug } from "@/lib/slug";
import { fingerprintOrderItems } from "@/lib/order-reorder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  tenant: z.string().min(1),
  /** Comma-separated order ids tracked client-side by guest customers. */
  ids: z.string().optional(),
  /** How many distinct orders to return - capped at 5. */
  limit: z.coerce.number().int().min(1).max(5).default(3),
});

/**
 * Returns up to `limit` distinct previous orders for the home screen
 * "previous orders" rail. Two orders with the same content fingerprint
 * (same items + sizes + options + quantities + notes) collapse so the
 * rail never shows the same basket twice.
 *
 *  - Logged-in customer → fetch their own recent orders for this tenant.
 *  - Guest (no session) → fetch the orders matching the comma-separated
 *    `ids` query param, which the client reads from localStorage. The
 *    order id is a UUID v4 so possession of the id is the access token.
 */
export const GET = handler(async (req: Request) => {
  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    tenant: url.searchParams.get("tenant") ?? "",
    ids: url.searchParams.get("ids") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return apiError("bad_request", "Invalid query", 400);
  }
  const { tenant: tenantSlug, ids, limit } = parsed.data;

  const tenant = await resolveTenantBySlug(tenantSlug);
  if (!tenant) return apiError("not_found", "Tenant not found", 404);

  const session = await getSession();

  // Pull a wider window (limit * 4) before deduping so we still surface
  // `limit` distinct baskets when a customer keeps re-ordering the same thing.
  const fetchLimit = limit * 4;

  let orders: Awaited<ReturnType<typeof fetchOrders>>;
  if (session?.type === "customer") {
    orders = await fetchOrders({
      where: { tenantId: tenant.id, customerId: session.userId },
      take: fetchLimit,
    });
  } else if (ids) {
    const idList = ids
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, fetchLimit);
    if (idList.length === 0) return apiJson({ orders: [] });
    // Guests: only return orders that belong to this tenant; never expose
    // another tenant's orders even if the id is somehow guessed.
    orders = await fetchOrders({
      where: { id: { in: idList }, tenantId: tenant.id },
      take: fetchLimit,
    });
  } else {
    return apiJson({ orders: [] });
  }

  // Deduplicate by content fingerprint, keeping the most recent of each set.
  const seen = new Set<string>();
  const distinct: typeof orders = [];
  for (const o of orders) {
    const sig = fingerprintOrderItems(o.items);
    if (seen.has(sig)) continue;
    seen.add(sig);
    distinct.push(o);
    if (distinct.length >= limit) break;
  }

  return apiJson({
    orders: distinct.map((o) => ({
      id: o.id,
      number: o.number,
      total: o.total,
      status: o.status,
      created_at: o.createdAt.toISOString(),
      item_count: o.items.reduce((sum, it) => sum + it.quantity, 0),
      headline_item: o.items[0]?.nameSnapshot ?? null,
      headline_image: o.items[0]?.menuItem?.images?.[0] ?? null,
    })),
  });
});

async function fetchOrders(args: {
  where: Prisma.OrderWhereInput;
  take: number;
}) {
  return prisma.order.findMany({
    where: args.where,
    orderBy: { createdAt: "desc" },
    take: args.take,
    select: {
      id: true,
      number: true,
      total: true,
      status: true,
      createdAt: true,
      items: {
        orderBy: { totalPrice: "desc" },
        select: {
          menuItemId: true,
          nameSnapshot: true,
          quantity: true,
          sizeId: true,
          selectedOptions: true,
          notes: true,
          menuItem: { select: { images: true } },
        },
      },
    },
  });
}
