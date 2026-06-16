import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SLUG = "pizzeria-verde";

const people = [
  { phone: "+972501222001", firstName: "נועה", lastName: "ישראלי" },
  { phone: "+972501222002", firstName: "תמר", lastName: "דהן" },
  { phone: "+972501222003", firstName: "אורי", lastName: "מימון" },
  { phone: "+972501222004", firstName: "דניאל", lastName: "כהן" },
  { phone: "+972501222005", firstName: "מאיה", lastName: "לוי" },
  { phone: "+972501222006", firstName: "יונתן", lastName: "פרץ" },
  { phone: "+972501222007", firstName: "שירה", lastName: "אזולאי" },
  { phone: "+972501222008", firstName: "איתי", lastName: "בן דוד" },
  { phone: "+972501222009", firstName: "רוני", lastName: "שלום" },
  { phone: "+972501222010", firstName: "ליאור", lastName: "מזרחי" },
];

// Yesterday = 2026-06-14. UTC hours 11..19 fall inside the chart window (11-23)
// both as UTC AND as Israel time (UTC+3 -> 14..22), so they show regardless of
// which clock the server buckets by.
const orderPlan = [
  { utcHour: 11, minute: 12, method: "delivery" as const, pay: "card" as const, notes: null },
  { utcHour: 12, minute: 5, method: "delivery" as const, pay: "bit" as const, notes: "בלי בצל" },
  { utcHour: 12, minute: 48, method: "pickup" as const, pay: "cash" as const, notes: null },
  { utcHour: 13, minute: 30, method: "delivery" as const, pay: "card" as const, notes: "קומה 2" },
  { utcHour: 14, minute: 20, method: "delivery" as const, pay: "card" as const, notes: null },
  { utcHour: 15, minute: 40, method: "pickup" as const, pay: "cash" as const, notes: null },
  { utcHour: 16, minute: 15, method: "delivery" as const, pay: "bit" as const, notes: "להתקשר בהגעה" },
  { utcHour: 17, minute: 35, method: "delivery" as const, pay: "card" as const, notes: null },
  { utcHour: 18, minute: 25, method: "delivery" as const, pay: "card" as const, notes: null },
  { utcHour: 19, minute: 10, method: "pickup" as const, pay: "cash" as const, notes: "לחתוך ל-8" },
];

function pick<T>(a: T[]): T {
  return a[Math.floor(Math.random() * a.length)];
}

async function main() {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: SLUG },
    include: { branches: { where: { isPrimary: true }, take: 1 } },
  });
  if (!tenant) throw new Error(`Tenant '${SLUG}' not found`);
  const branch = tenant.branches[0];
  if (!branch) throw new Error("No primary branch");

  // ── Wipe ALL orders for this tenant (cascades items/events/reviews) ──
  const del = await prisma.order.deleteMany({ where: { tenantId: tenant.id } });
  console.log(`✓ Deleted ${del.count} existing orders (and cascaded items/reviews).`);

  for (const c of people) {
    await prisma.customer.upsert({
      where: { phone: c.phone },
      update: { firstName: c.firstName, lastName: c.lastName },
      create: c,
    });
  }
  const custRows = await prisma.customer.findMany({
    where: { phone: { in: people.map((c) => c.phone) } },
    select: { id: true, firstName: true, lastName: true, phone: true },
  });
  const byPhone = new Map(custRows.map((c) => [c.phone, c]));

  const items = await prisma.menuItem.findMany({
    where: { tenantId: tenant.id, available: true },
    include: {
      sizes: { orderBy: { position: "asc" } },
      optionGroups: { include: { options: true }, orderBy: { position: "asc" } },
    },
  });
  if (items.length === 0) throw new Error("No menu items found for tenant");

  const MIN = 60 * 1000;

  function buildLine(it: (typeof items)[number]) {
    const size = it.sizes.find((s) => s.isDefault) ?? it.sizes[0] ?? null;
    const sizeDelta = size?.priceDelta ?? 0;
    const selectedOptions: Array<{ group_id: string; option_id: string; name: string; price_delta: number }> = [];
    let optDelta = 0;
    for (const g of it.optionGroups) {
      if (g.options.length === 0) continue;
      if (g.required || Math.random() < 0.4) {
        const opt = pick(g.options);
        selectedOptions.push({ group_id: g.id, option_id: opt.id, name: opt.name, price_delta: opt.priceDelta ?? 0 });
        optDelta += opt.priceDelta ?? 0;
      }
    }
    const quantity = 1 + (Math.random() < 0.25 ? 1 : 0);
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
      source: "menu" as const,
    };
  }

  let created = 0;
  for (let i = 0; i < orderPlan.length; i++) {
    const p = orderPlan[i];
    const cust = byPhone.get(people[i].phone)!;
    const createdAt = new Date(Date.UTC(2026, 5, 14, p.utcHour, p.minute)); // 2026-06-14

    const lineCount = 1 + Math.floor(Math.random() * 3);
    const picks: ReturnType<typeof buildLine>[] = [];
    for (let l = 0; l < lineCount; l++) picks.push(buildLine(items[(i + l) % items.length]));

    const subtotal = picks.reduce((acc, l) => acc + l.totalPrice, 0);
    const deliveryFee = p.method === "delivery" ? branch.deliveryFee ?? 14 : 0;
    const serviceFee = 3;
    const total = subtotal + deliveryFee + serviceFee;

    const confirmedAt = new Date(createdAt.getTime() + 2 * MIN);
    const readyAt = new Date(confirmedAt.getTime() + 14 * MIN);
    const deliveredAt = new Date(readyAt.getTime() + 18 * MIN);

    await prisma.order.create({
      data: {
        number: `ORD-${1401 + i}`,
        tenantId: tenant.id,
        branchId: branch.id,
        customerId: cust.id,
        status: "delivered",
        method: p.method,
        source: "direct",
        subtotal,
        deliveryFee,
        serviceFee,
        tip: 0,
        discount: 0,
        total,
        paymentMethod: p.pay,
        paymentStatus: "paid",
        customerPhoneSnap: cust.phone,
        customerFirstNameSnap: cust.firstName,
        customerLastNameSnap: cust.lastName,
        customerNotes: p.notes,
        createdAt,
        confirmedAt,
        readyAt,
        deliveredAt,
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

  console.log(`✓ Created ${created} delivered orders dated 2026-06-14 (ORD-1401..ORD-${1400 + created}).`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
