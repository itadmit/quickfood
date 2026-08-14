import { PrismaClient } from "@prisma/client";

import { publish, orderRoom, tenantRoom } from "@/lib/realtime/worker";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Realtime is published from a Prisma extension rather than from each write
 * site.
 *
 * There are a dozen places that create an `orderEvent` — refunds, item
 * edits, courier pickup, POS sales, the Wolt and Delivapp integrations — and
 * a thirteenth will be added by someone who does not know a board is
 * listening. Hooking the write itself makes "the board updates" a property
 * of the data model instead of a convention every future author has to
 * remember.
 *
 * On rollback: this fires inside transactions, so a publish can escape for a
 * write that is then rolled back. That is tolerable here because the frame
 * carries no state — every client treats it purely as "something moved, go
 * refetch", and a refetch after a rollback simply shows the unchanged board.
 * Sending the row contents instead would have made this a real bug.
 */
function withRealtime(client: PrismaClient) {
  return client.$extends({
    query: {
      orderEvent: {
        async create({ args, query }) {
          const result = await query(args);
          try {
            const orderId = (args.data as { orderId?: string })?.orderId;
            const type = (args.data as { type?: string })?.type ?? "updated";
            if (orderId) {
              // The tenant is not on the event row, so it is read back once.
              // Cheap next to the write, and it keeps every call site free of
              // the obligation to pass it.
              const order = await client.order.findUnique({
                where: { id: orderId },
                select: { tenantId: true, number: true },
              });
              if (order) {
                void publish(tenantRoom(order.tenantId), `order.${type}`, {
                  order_id: orderId,
                  number: order.number,
                });
                void publish(orderRoom(orderId), "status_changed", {
                  order_id: orderId,
                });
              }
            }
          } catch (err) {
            // A realtime failure must never fail the write it followed.
            console.error("[realtime] orderEvent publish failed:", err);
          }
          return result;
        },
      },
      order: {
        async create({ args, query }) {
          const result = await query(args);
          try {
            const row = result as { id?: string; tenantId?: string; number?: unknown };
            if (row?.tenantId && row.id) {
              void publish(tenantRoom(row.tenantId), "order.created", {
                id: row.id,
                number: row.number,
              });
            }
          } catch (err) {
            console.error("[realtime] order publish failed:", err);
          }
          return result;
        },
      },
    },
  });
}

const base =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = base;

export const prisma = withRealtime(base) as unknown as PrismaClient;
