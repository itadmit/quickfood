import { handler, apiJson, apiError } from "@/lib/api-response";
import { prisma } from "@/lib/db/client";
import { resolveTenantBySlug } from "@/lib/slug";
import { getSession } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (req: Request) => {
  const url = new URL(req.url);
  const slug = url.searchParams.get("tenant");
  const idsParam = url.searchParams.get("ids");
  if (!slug) return apiError("validation_error", "missing tenant", 422);

  const tenant = await resolveTenantBySlug(slug);
  if (!tenant) return apiError("not_found", "tenant not found", 404);

  const session = await getSession();

  const where: Record<string, unknown> = { tenantId: tenant.id };
  if (session?.type === "customer") {
    where.customerId = session.userId;
  } else if (idsParam) {
    const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 5);
    if (ids.length === 0) return apiJson({ orders: [] });
    where.id = { in: ids };
  } else {
    return apiJson({ orders: [] });
  }

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      number: true,
      createdAt: true,
      items: {
        select: {
          nameSnapshot: true,
          quantity: true,
        },
      },
    },
  });

  return apiJson({
    orders: orders.map((o) => ({
      number: o.number,
      createdAt: o.createdAt.toISOString().slice(0, 10),
      items: o.items.map((i) => ({
        name: i.nameSnapshot,
        quantity: i.quantity,
      })),
    })),
  });
});
