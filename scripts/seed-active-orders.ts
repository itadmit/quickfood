import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SLUG = "pizzeria-verde";

const customers = [
  { phone: "+972502333001", firstName: "דניאל", lastName: "כהן" },
  { phone: "+972502333002", firstName: "מאיה", lastName: "לוי" },
  { phone: "+972502333003", firstName: "יונתן", lastName: "פרץ" },
  { phone: "+972502333004", firstName: "שירה", lastName: "אזולאי" },
  { phone: "+972502333005", firstName: "איתי", lastName: "בן דוד" },
  { phone: "+972502333006", firstName: "רוני", lastName: "שלום" },
  { phone: "+972502333007", firstName: "ליאור", lastName: "מזרחי" },
  { phone: "+972502333008", firstName: "תהל", lastName: "אדרי" },
];

type Status =
  | "pending"
  | "confirmed"
  | "preparing"
  | "in_oven"
  | "ready"
  | "out_for_delivery";

const plan: Array<{
  status: Status;
  method: "delivery" | "pickup";
  paymentMethod: "cash" | "card" | "bit";
  paymentStatus: "pending" | "paid";
  minsAgo: number;
  itemCount: number;
  notes?: string;
}> = [
  { status: "pending", method: "delivery", paymentMethod: "card", paymentStatus: "paid", minsAgo: 2, itemCount: 2, notes: "בלי בצל בבקשה" },
  { status: "pending", method: "pickup", paymentMethod: "cash", paymentStatus: "pending", minsAgo: 5, itemCount: 1 },
  { status: "confirmed", method: "delivery", paymentMethod: "bit", paymentStatus: "paid", minsAgo: 9, itemCount: 3, notes: "קומה 3, דירה משמאל" },
  { status: "confirmed", method: "delivery", paymentMethod: "card", paymentStatus: "paid", minsAgo: 13, itemCount: 2 },
  { status: "preparing", method: "pickup", paymentMethod: "cash", paymentStatus: "pending", minsAgo: 18, itemCount: 2 },
  { status: "preparing", method: "delivery", paymentMethod: "card", paymentStatus: "paid", minsAgo: 22, itemCount: 4, notes: "לחתוך ל-8 משולשים" },
  { status: "in_oven", method: "delivery", paymentMethod: "bit", paymentStatus: "paid", minsAgo: 27, itemCount: 2 },
  { status: "ready", method: "pickup", paymentMethod: "cash", paymentStatus: "paid", minsAgo: 34, itemCount: 1 },
  { status: "ready", method: "delivery", paymentMethod: "card", paymentStatus: "paid", minsAgo: 38, itemCount: 3 },
  { status: "out_for_delivery", method: "delivery", paymentMethod: "card", paymentStatus: "paid", minsAgo: 46, itemCount: 2, notes: "להתקשר בהגעה" },
];

async function main() {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: SLUG },
    include: { branches: { where: { isPrimary: true }, take: 1 } },
  });
  if (!tenant) throw new Error(`Tenant '${SLUG}' not found`);
  const branch = tenant.branches[0];
  if (!branch) throw new Error("No primary branch");

  for (const c of customers) {
    await prisma.customer.upsert({
      where: { phone: c.phone },
      update: { firstName: c.firstName, lastName: c.lastName },
      create: c,
    });
  }
  const customerIds = await prisma.customer.findMany({
    where: { phone: { in: customers.map((c) => c.phone) } },
    select: { id: true, firstName: true, lastName: true, phone: true },
  });

  const items = await prisma.menuItem.findMany({
    where: { tenantId: tenant.id, available: true },
    include: {
      sizes: { orderBy: { position: "asc" } },
      optionGroups: { include: { options: true }, orderBy: { position: "asc" } },
    },
  });
  if (items.length === 0) throw new Error("No menu items found for tenant");

  // Idempotent: wipe prior LIVE-* orders for a clean screenshot board.
  await prisma.order.deleteMany({
    where: { tenantId: tenant.id, number: { startsWith: "LIVE-" } },
  });

  const now = Date.now();
  const MIN = 60 * 1000;

  function buildLine(it: (typeof items)[number]) {
    const size = it.sizes.find((s) => s.isDefault) ?? it.sizes[0] ?? null;
    const sizeDelta = size?.priceDelta ?? 0;
    const selectedOptions: Array<{
      group_id: string;
      option_id: string;
      name: string;
      price_delta: number;
    }> = [];
    let optDelta = 0;
    for (const g of it.optionGroups) {
      if (g.options.length === 0) continue;
      if (g.required || Math.random() < 0.5) {
        const opt = g.options[Math.floor(Math.random() * g.options.length)];
        selectedOptions.push({
          group_id: g.id,
          option_id: opt.id,
          name: opt.name,
          price_delta: opt.priceDelta ?? 0,
        });
        optDelta += opt.priceDelta ?? 0;
      }
    }
    const unitPrice = it.basePrice + sizeDelta + optDelta;
    return {
      menuItemId: it.id,
      nameSnapshot: it.name,
      quantity: 1,
      unitPrice,
      totalPrice: unitPrice,
      sizeId: size?.id ?? null,
      sizeSnapshot: size?.name ?? null,
      selectedOptions,
      source: "menu" as const,
    };
  }

  let created = 0;
  for (let i = 0; i < plan.length; i++) {
    const p = plan[i];
    const cust = customerIds[i % customerIds.length];
    const createdAt = new Date(now - p.minsAgo * MIN);
    const confirmedAt =
      p.status === "pending" ? null : new Date(createdAt.getTime() + 90 * 1000);
    const readyAt =
      p.status === "ready" || p.status === "out_for_delivery"
        ? new Date(createdAt.getTime() + 15 * MIN)
        : null;

    const picks: ReturnType<typeof buildLine>[] = [];
    for (let k = 0; k < p.itemCount; k++) {
      const it = items[(i + k) % items.length];
      const line = buildLine(it);
      line.quantity = k === 0 ? 1 : 1 + (k % 2);
      line.totalPrice = line.unitPrice * line.quantity;
      picks.push(line);
    }

    const subtotal = picks.reduce((acc, l) => acc + l.totalPrice, 0);
    const deliveryFee = p.method === "delivery" ? branch.deliveryFee ?? 14 : 0;
    const serviceFee = 3;
    const total = subtotal + deliveryFee + serviceFee;

    await prisma.order.create({
      data: {
        number: `LIVE-${1000 + i}`,
        tenantId: tenant.id,
        branchId: branch.id,
        customerId: cust.id,
        status: p.status,
        method: p.method,
        source: "direct",
        subtotal,
        deliveryFee,
        serviceFee,
        tip: 0,
        discount: 0,
        total,
        paymentMethod: p.paymentMethod,
        paymentStatus: p.paymentStatus,
        customerPhoneSnap: cust.phone,
        customerFirstNameSnap: cust.firstName,
        customerLastNameSnap: cust.lastName,
        customerNotes: p.notes ?? null,
        createdAt,
        confirmedAt,
        readyAt,
        items: {
          createMany: {
            data: picks.map((l) => ({
              menuItemId: l.menuItemId,
              nameSnapshot: l.nameSnapshot,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              totalPrice: l.totalPrice,
              sizeId: l.sizeId,
              sizeSnapshot: l.sizeSnapshot,
              selectedOptions: l.selectedOptions as unknown as object,
              source: l.source,
            })),
          },
        },
      },
    });
    created++;
  }

  console.log(`✓ Seeded ${created} active orders for '${SLUG}' (numbers LIVE-1000..LIVE-${1000 + created - 1}).`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
