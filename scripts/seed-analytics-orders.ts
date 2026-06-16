import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SLUG = "pizzeria-verde";

// The dashboard "הזמנות לפי שעה" chart buckets by createdAt.getHours() in the
// SERVER timezone (unknown / not necessarily UTC) and renders hour buckets
// 11..23. To guarantee that window fills regardless of the server's timezone
// offset, seed across ALL 24 hours of each day.
const VISIBLE_HOURS = Array.from({ length: 24 }, (_, i) => i); // 0..23

// Relative volume per UTC hour. Every hour > 0 so all server-side buckets fill.
const HOUR_WEIGHT: Record<number, number> = {
  0: 2, 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 3, 7: 3, 8: 4, 9: 5, 10: 5, 11: 4,
  12: 3, 13: 4, 14: 5, 15: 5, 16: 4, 17: 3, 18: 4, 19: 5, 20: 5, 21: 4, 22: 3, 23: 2,
};

const regulars = [
  { phone: "+972503444001", firstName: "אבי", lastName: "ביטון" },
  { phone: "+972503444002", firstName: "מיכל", lastName: "הראל" },
  { phone: "+972503444003", firstName: "עומר", lastName: "נחום" },
  { phone: "+972503444004", firstName: "נטע", lastName: "גבאי" },
  { phone: "+972503444005", firstName: "גיא", lastName: "סבן" },
];

const guests = [
  { phone: "+972504555010", firstName: "רותם", lastName: "אבני" },
  { phone: "+972504555011", firstName: "אלה", lastName: "כספי" },
  { phone: "+972504555012", firstName: "יואב", lastName: "פלד" },
  { phone: "+972504555013", firstName: "שני", lastName: "ברק" },
  { phone: "+972504555014", firstName: "תום", lastName: "אש" },
  { phone: "+972504555015", firstName: "הדר", lastName: "לביא" },
  { phone: "+972504555016", firstName: "עידן", lastName: "מור" },
  { phone: "+972504555017", firstName: "ליה", lastName: "צור" },
];

type Status = "delivered" | "ready" | "out_for_delivery";
type Source = "direct" | "ai_advisor" | "reorder";

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: SLUG },
    include: { branches: { where: { isPrimary: true }, take: 1 } },
  });
  if (!tenant) throw new Error(`Tenant '${SLUG}' not found`);
  const branch = tenant.branches[0];
  if (!branch) throw new Error("No primary branch");

  for (const c of [...regulars, ...guests]) {
    await prisma.customer.upsert({
      where: { phone: c.phone },
      update: { firstName: c.firstName, lastName: c.lastName },
      create: c,
    });
  }
  const custRows = await prisma.customer.findMany({
    where: { phone: { in: [...regulars, ...guests].map((c) => c.phone) } },
    select: { id: true, firstName: true, lastName: true, phone: true },
  });
  const byPhone = new Map(custRows.map((c) => [c.phone, c]));
  const regularRows = regulars.map((c) => byPhone.get(c.phone)!);
  const guestRows = guests.map((c) => byPhone.get(c.phone)!);

  const items = await prisma.menuItem.findMany({
    where: { tenantId: tenant.id, available: true },
    include: {
      sizes: { orderBy: { position: "asc" } },
      optionGroups: { include: { options: true }, orderBy: { position: "asc" } },
    },
  });
  if (items.length === 0) throw new Error("No menu items found for tenant");

  await prisma.order.deleteMany({
    where: { tenantId: tenant.id, number: { startsWith: "HIST-" } },
  });

  const MIN = 60 * 1000;
  const now = new Date();
  const nowMs = now.getTime();

  // Build the list of (UTC date, UTC hour) slots: last 14 days, hours 11..23,
  // skipping any slot in the future relative to now. 14 days so both the
  // current AND previous series fill for the 7d range.
  const slots: Array<{ y: number; mo: number; d: number; h: number }> = [];
  for (let dayBack = 14; dayBack >= 0; dayBack--) {
    const base = new Date(nowMs - dayBack * 24 * 60 * MIN);
    const y = base.getUTCFullYear();
    const mo = base.getUTCMonth();
    const d = base.getUTCDate();
    for (const h of VISIBLE_HOURS) {
      slots.push({ y, mo, d, h });
    }
  }

  function buildLine(it: (typeof items)[number], asUpsell: boolean) {
    const size = it.sizes.find((s) => s.isDefault) ?? it.sizes[0] ?? null;
    const sizeDelta = size?.priceDelta ?? 0;
    const selectedOptions: Array<{ group_id: string; option_id: string; name: string; price_delta: number }> = [];
    let optDelta = 0;
    for (const g of it.optionGroups) {
      if (g.options.length === 0) continue;
      if (g.required || Math.random() < 0.45) {
        const opt = pick(g.options);
        selectedOptions.push({ group_id: g.id, option_id: opt.id, name: opt.name, price_delta: opt.priceDelta ?? 0 });
        optDelta += opt.priceDelta ?? 0;
      }
    }
    const quantity = 1 + (Math.random() < 0.3 ? 1 : 0);
    const unitPrice = it.basePrice + sizeDelta + optDelta;
    return {
      menuItemId: it.id,
      nameSnapshot: it.name,
      quantity,
      unitPrice,
      totalPrice: unitPrice * quantity,
      sizeId: size?.id ?? null,
      sizeSnapshot: size?.name ?? null,
      selectedOptions,
      source: (asUpsell ? "upsell" : "menu") as "menu" | "upsell",
    };
  }

  let created = 0;
  let seq = 0;
  for (const slot of slots) {
    const weight = HOUR_WEIGHT[slot.h] ?? 2;
    const count = Math.max(1, weight - 1 + Math.floor(Math.random() * 2)); // ~weight orders

    for (let k = 0; k < count; k++) {
      const minute = Math.floor(Math.random() * 58) + 1;
      const createdAt = new Date(Date.UTC(slot.y, slot.mo, slot.d, slot.h, minute));
      if (createdAt.getTime() >= nowMs) continue; // skip future slots

      const returning = Math.random() < 0.55;
      const cust = returning ? pick(regularRows) : pick(guestRows);

      const source: Source = Math.random() < 0.18 ? "ai_advisor" : Math.random() < 0.12 ? "reorder" : "direct";
      const method: "delivery" | "pickup" = Math.random() < 0.7 ? "delivery" : "pickup";
      const status: Status = Math.random() < 0.85 ? "delivered" : Math.random() < 0.5 ? "ready" : "out_for_delivery";

      const lineCount = 1 + Math.floor(Math.random() * 3);
      const picks: ReturnType<typeof buildLine>[] = [];
      for (let l = 0; l < lineCount; l++) {
        picks.push(buildLine(pick(items), l > 0 && Math.random() < 0.35));
      }

      const subtotal = picks.reduce((acc, p) => acc + p.totalPrice, 0);
      const deliveryFee = method === "delivery" ? branch.deliveryFee ?? 14 : 0;
      const serviceFee = 3;
      const tip = method === "delivery" && Math.random() < 0.25 ? pick([5, 10, 10, 15]) : 0;
      const total = subtotal + deliveryFee + serviceFee + tip;

      const confirmedAt = new Date(createdAt.getTime() + (1 + Math.random() * 2) * MIN);
      const readyAt = new Date(confirmedAt.getTime() + (9 + Math.random() * 12) * MIN);
      const deliveredAt = status === "delivered" ? new Date(readyAt.getTime() + (12 + Math.random() * 18) * MIN) : null;

      seq++;
      await prisma.order.create({
        data: {
          number: `HIST-${100000 + seq}`,
          tenantId: tenant.id,
          branchId: branch.id,
          customerId: cust.id,
          status,
          method,
          source,
          subtotal,
          deliveryFee,
          serviceFee,
          tip,
          discount: 0,
          total,
          paymentMethod: pick(["cash", "card", "card", "bit"]),
          paymentStatus: "paid",
          customerPhoneSnap: cust.phone,
          customerFirstNameSnap: cust.firstName,
          customerLastNameSnap: cust.lastName,
          createdAt,
          confirmedAt,
          readyAt,
          deliveredAt,
          kanbanHiddenAt: status !== "delivered" ? createdAt : null,
          items: {
            createMany: {
              data: picks.map((p) => ({
                menuItemId: p.menuItemId,
                nameSnapshot: p.nameSnapshot,
                quantity: p.quantity,
                unitPrice: p.unitPrice,
                totalPrice: p.totalPrice,
                sizeId: p.sizeId,
                sizeSnapshot: p.sizeSnapshot,
                selectedOptions: p.selectedOptions as unknown as object,
                source: p.source,
              })),
            },
          },
        },
      });
      created++;
    }
  }

  console.log(`✓ Seeded ${created} completed orders (HIST-*) across UTC hours 11-23 over the last 8 days.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
