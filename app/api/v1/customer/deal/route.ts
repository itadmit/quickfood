import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { resolveTenantBySlug } from "@/lib/slug";
import { loadMenuItemForCustomer } from "@/lib/menu-item-load";
import { isItemVisibleNow } from "@/lib/menu-availability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Deal composer payload: the deal shell + the LIVE customer payload of
 *  every choosable item (option groups included), so a new topping the
 *  merchant adds shows up in the composer immediately - no re-entry. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug") ?? "";
  const id = searchParams.get("id") ?? "";
  if (!slug || !id) {
    return NextResponse.json({ error: "missing params" }, { status: 400 });
  }

  const tenant = await resolveTenantBySlug(slug);
  if (!tenant) return NextResponse.json({ error: "not found" }, { status: 404 });

  const deal = await prisma.deal.findFirst({
    where: { id, tenantId: tenant.id, active: true },
    include: {
      slots: {
        orderBy: { position: "asc" },
        include: {
          choices: { orderBy: { position: "asc" }, include: { item: true } },
        },
      },
    },
  });
  if (!deal) return NextResponse.json({ error: "not found" }, { status: 404 });

  const visibleItemIds = new Set(
    deal.slots
      .flatMap((s) => s.choices.map((c) => c.item))
      .filter((i) => i.available && isItemVisibleNow(i))
      .map((i) => i.id),
  );

  const loaded = await Promise.all(
    Array.from(visibleItemIds).map((itemId) => loadMenuItemForCustomer(slug, itemId)),
  );
  const itemsById: Record<string, NonNullable<(typeof loaded)[number]>["item"]> = {};
  for (const l of loaded) {
    if (l) itemsById[l.item.id] = l.item;
  }

  return NextResponse.json({
    deal: {
      id: deal.id,
      name: deal.name,
      description: deal.description,
      imageUrl: deal.imageUrl,
      fixedPrice: deal.fixedPrice,
      slots: deal.slots.map((s) => ({
        id: s.id,
        name: s.name,
        quantity: s.quantity,
        itemIds: s.choices.map((c) => c.itemId).filter((iid) => visibleItemIds.has(iid)),
      })),
    },
    items: itemsById,
  });
}
