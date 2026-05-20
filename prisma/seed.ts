import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // ─── Plans ─────────────────────────────────────────────────────
  await prisma.plan.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      name: "Starter",
      priceMonthly: 199,
      features: { orderLimit: 50 },
      orderLimit: 50,
    },
    update: {},
  });
  await prisma.plan.upsert({
    where: { id: "00000000-0000-0000-0000-000000000002" },
    create: {
      id: "00000000-0000-0000-0000-000000000002",
      name: "Growth",
      priceMonthly: 499,
      features: { analytics: true, reviews: true },
    },
    update: {},
  });

  // ─── Demo tenant: פיצרייה ורדה (theme: fresh) ──────────────────
  const tenant = await prisma.tenant.upsert({
    where: { slug: "pizzeria-verde" },
    create: {
      slug: "pizzeria-verde",
      name: "פיצרייה ורדה",
      logoLetter: "ו",
      themeId: "fresh",
      businessType: "pizza",
      cuisineType: "פיצה נפוליטנית",
      status: "active",
      planId: "00000000-0000-0000-0000-000000000001",
    },
    update: { businessType: "pizza" },
  });

  const branch = await prisma.branch.upsert({
    where: { id: tenant.id }, // not unique, but we'll use a deterministic check via findFirst below
    create: {
      id: tenant.id, // intentional re-use to keep test data tidy; OK for seeding
      tenantId: tenant.id,
      name: "סניף ראשי",
      address: "אלנבי 42, תל אביב",
      phone: "03-555-1234",
      email: "verde@example.com",
      isPrimary: true,
      status: "open",
      hours: {
        sunday: { open: "11:00", close: "23:00", active: true },
        monday: { open: "11:00", close: "23:00", active: true },
        tuesday: { open: "11:00", close: "23:00", active: true },
        wednesday: { open: "11:00", close: "23:00", active: true },
        thursday: { open: "11:00", close: "00:00", active: true },
        friday: { open: "11:00", close: "16:00", active: true },
        saturday: { open: "20:00", close: "01:00", active: true },
      },
      minOrder: 60,
      deliveryFee: 14,
      serviceFee: 3,
    },
    update: {},
  });

  await prisma.deliveryZone.upsert({
    where: { id: tenant.id }, // same trick
    create: {
      id: tenant.id,
      branchId: branch.id,
      name: "מרכז ת״א",
      radiusKm: 3.5,
      deliveryFee: 14,
      minEta: 25,
      maxEta: 35,
    },
    update: {},
  });

  // ─── Categories ───────────────────────────────────────────────
  const catNames = ["קלאסיות", "מיוחדות", "טבעוניות", "שתייה", "קינוחים"];
  const categories = [] as Array<{ id: string; name: string }>;
  for (let i = 0; i < catNames.length; i++) {
    const cat = await prisma.menuCategory.create({
      data: {
        tenantId: tenant.id,
        name: catNames[i],
        position: i,
        active: true,
      },
    });
    categories.push({ id: cat.id, name: cat.name });
  }
  const [classic, special, vegan, drinks, dessert] = categories;

  // ─── Items ────────────────────────────────────────────────────
  const items: Array<{ name: string; cat: string; price: number; art: string; tags: string[]; desc: string }> = [
    { name: "מרגריטה",  cat: classic.id, price: 58, art: "margherita", tags: ["פופולרי", "צמחוני"], desc: "רוטב עגבניות סן מרצאנו, מוצרלה של באפלו, בזיליקום טרי" },
    { name: "פפרוני",   cat: classic.id, price: 68, art: "pepperoni",  tags: ["פופולרי"], desc: "פפרוני איטלקי איכותי, מוצרלה, רוטב עגבניות" },
    { name: "פטריות",   cat: classic.id, price: 64, art: "funghi",     tags: ["צמחוני"], desc: "פטריות פורצ׳יני, מוצרלה, שמן כמהין" },
    { name: "זיתים",    cat: classic.id, price: 60, art: "olives",     tags: ["צמחוני"], desc: "זיתי קלמטה, מוצרלה, אורגנו" },
    { name: "ביאנקה",   cat: special.id, price: 72, art: "bianca",     tags: ["מיוחדת"], desc: "ללא רוטב, מוצרלה, ריקוטה, רוזמרין" },
    { name: "כמהין",    cat: special.id, price: 84, art: "truffle",    tags: ["מיוחדת"], desc: "שמן כמהין, פטריות, מוצרלה, פרמזן" },
    { name: "רוקולה",   cat: special.id, price: 70, art: "rucola",     tags: ["צמחוני"], desc: "רוקולה טרייה, גבינת בריא, עגבניות" },
    { name: "דיאבולה",  cat: special.id, price: 72, art: "diavola",    tags: ["חריפה"],  desc: "פפרוני חריף, צ׳ילי, מוצרלה" },
    { name: "פיצה טבעונית", cat: vegan.id, price: 66, art: "margherita", tags: ["טבעוני"], desc: "מוצרלה טבעונית, רוטב עגבניות, ירקות עונתיים" },
    { name: "קולה זירו",   cat: drinks.id,  price: 12, art: "margherita", tags: [], desc: "קולה זירו 500 מ״ל" },
    { name: "ספרייט",      cat: drinks.id,  price: 12, art: "margherita", tags: [], desc: "ספרייט 500 מ״ל" },
    { name: "טירמיסו",     cat: dessert.id, price: 28, art: "margherita", tags: ["פופולרי"], desc: "טירמיסו ביתי" },
  ];

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const item = await prisma.menuItem.create({
      data: {
        tenantId: tenant.id,
        categoryId: it.cat,
        name: it.name,
        description: it.desc,
        artType: it.art,
        basePrice: it.price,
        prepMinutes: it.cat === drinks.id || it.cat === dessert.id ? 0 : 9,
        position: i,
        tags: it.tags,
      },
    });

    // Pizzas get sizes + crust options + extras
    const isPizza = it.cat === classic.id || it.cat === special.id || it.cat === vegan.id;
    if (isPizza) {
      await prisma.itemSize.createMany({
        data: [
          { itemId: item.id, code: "S", name: "אישית (25 ס\"מ)", priceDelta: -10, isDefault: false, position: 0 },
          { itemId: item.id, code: "M", name: "משפחתית (32 ס\"מ)", priceDelta: 0, isDefault: true, position: 1 },
          { itemId: item.id, code: "L", name: "XL (40 ס\"מ)", priceDelta: 14, isDefault: false, position: 2 },
        ],
      });

      const crustGroup = await prisma.itemOptionGroup.create({
        data: {
          itemId: item.id,
          name: "סוג בצק",
          type: "single",
          required: true,
          minSelect: 1,
          maxSelect: 1,
          position: 0,
        },
      });
      await prisma.itemOption.createMany({
        data: [
          { groupId: crustGroup.id, name: "קלאסי", priceDelta: 0, isDefault: true, position: 0 },
          { groupId: crustGroup.id, name: "דק ופריך", priceDelta: 0, position: 1 },
          { groupId: crustGroup.id, name: "מחמצת", priceDelta: 6, position: 2 },
        ],
      });

      const extrasGroup = await prisma.itemOptionGroup.create({
        data: {
          itemId: item.id,
          name: "תוספות",
          type: "multi",
          required: false,
          minSelect: 0,
          maxSelect: 5,
          position: 1,
        },
      });
      await prisma.itemOption.createMany({
        data: [
          { groupId: extrasGroup.id, name: "גבינה נוספת", priceDelta: 8, position: 0 },
          { groupId: extrasGroup.id, name: "פטריות", priceDelta: 6, position: 1 },
          { groupId: extrasGroup.id, name: "זיתים", priceDelta: 5, position: 2 },
          { groupId: extrasGroup.id, name: "פלפל חריף", priceDelta: 4, position: 3 },
          { groupId: extrasGroup.id, name: "בצל", priceDelta: 4, position: 4 },
        ],
      });
    }
  }

  // ─── Merchant user ─────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("verde1234", 10);
  await prisma.merchantUser.upsert({
    where: { email: "owner@pizzeria-verde.local" },
    create: {
      tenantId: tenant.id,
      email: "owner@pizzeria-verde.local",
      passwordHash,
      name: "מאיה כהן",
      role: "owner",
    },
    update: {},
  });

  // ─── Platform admin ────────────────────────────────────────────
  const adminHash = await bcrypt.hash("admin1234", 10);
  await prisma.merchantUser.upsert({
    where: { email: "admin@quickfood.local" },
    create: {
      tenantId: null,
      email: "admin@quickfood.local",
      passwordHash: adminHash,
      name: "Platform Admin",
      role: "platform_admin",
    },
    update: {},
  });

  // ─── Webhook endpoint for testing ──────────────────────────────
  if (process.env.WEBHOOK_TEST_URL) {
    await prisma.webhookEndpoint.create({
      data: {
        tenantId: tenant.id,
        url: process.env.WEBHOOK_TEST_URL,
        events: ["order.created", "order.status_changed", "order.cancelled"],
        secret: "seedsecret_change_me_for_real_use_only",
        active: true,
      },
    });
  }

  // ─── Demo couriers ─────────────────────────────────────────────
  const existingCouriers = await prisma.courier.count({ where: { tenantId: tenant.id } });
  if (existingCouriers === 0) {
    await prisma.courier.createMany({
      data: [
        { tenantId: tenant.id, branchId: branch.id, name: "אבי לוי", phone: "+972501111001", vehicle: "scooter", status: "available", ratingAvg: 4.9, deliveriesToday: 3 },
        { tenantId: tenant.id, branchId: branch.id, name: "דנה כהן", phone: "+972501111002", vehicle: "bike", status: "on_delivery", ratingAvg: 4.7, deliveriesToday: 5 },
        { tenantId: tenant.id, branchId: branch.id, name: "יוסי ברק", phone: "+972501111003", vehicle: "scooter", status: "offline", ratingAvg: 4.8, deliveriesToday: 0 },
      ],
    });
  }

  // ─── Demo customers + delivered orders (for analytics + reviews) ──
  const existingDeliveredCount = await prisma.order.count({
    where: { tenantId: tenant.id, status: "delivered" },
  });

  if (existingDeliveredCount < 5) {
    const demoCustomers = [
      { phone: "+972501222001", name: "נועה ישראלי" },
      { phone: "+972501222002", name: "תמר דהן" },
      { phone: "+972501222003", name: "אורי מימון" },
    ];
    for (const c of demoCustomers) {
      await prisma.customer.upsert({
        where: { phone: c.phone },
        update: {},
        create: c,
      });
    }
    const customerIds = await prisma.customer.findMany({
      where: { phone: { in: demoCustomers.map((c) => c.phone) } },
      select: { id: true },
    });

    const itemRows = await prisma.menuItem.findMany({
      where: { tenantId: tenant.id },
      include: { sizes: { take: 1, where: { isDefault: true } } },
      take: 5,
    });

    const now = Date.now();
    const HOUR = 60 * 60 * 1000;
    const DAY = 24 * HOUR;

    for (let i = 0; i < 12; i++) {
      const cust = customerIds[i % customerIds.length];
      const offset = i * 3 * HOUR;
      const createdAt = new Date(now - offset);
      const confirmedAt = new Date(createdAt.getTime() + 60_000);
      const readyAt = new Date(confirmedAt.getTime() + (10 + (i % 8)) * 60_000);
      const deliveredAt = new Date(readyAt.getTime() + 22 * 60_000);
      const picks = itemRows.slice(0, 1 + (i % 3));
      const subtotal = picks.reduce((acc, it, idx) => acc + it.basePrice * (1 + (idx % 2)), 0);
      const total = subtotal + 14 + 3;

      await prisma.order.create({
        data: {
          number: `DEMO-${1000 + i}`,
          tenantId: tenant.id,
          branchId: branch.id,
          customerId: cust.id,
          status: "delivered",
          method: i % 4 === 0 ? "pickup" : "delivery",
          subtotal,
          deliveryFee: 14,
          serviceFee: 3,
          total,
          paymentMethod: "cash",
          paymentStatus: "paid",
          createdAt,
          confirmedAt,
          readyAt,
          deliveredAt,
          items: {
            createMany: {
              data: picks.map((it, idx) => ({
                menuItemId: it.id,
                nameSnapshot: it.name,
                quantity: 1 + (idx % 2),
                unitPrice: it.basePrice,
                totalPrice: it.basePrice * (1 + (idx % 2)),
                sizeId: it.sizes[0]?.id ?? null,
                sizeSnapshot: it.sizes[0]?.name ?? null,
                selectedOptions: [],
              })),
            },
          },
        },
      });

      // Add a review for half of the orders
      if (i % 2 === 0) {
        const orderRow = await prisma.order.findFirst({
          where: { number: `DEMO-${1000 + i}` },
          select: { id: true },
        });
        if (orderRow) {
          await prisma.review.create({
            data: {
              tenantId: tenant.id,
              orderId: orderRow.id,
              customerId: cust.id,
              rating: 3 + (i % 3),
              text: i % 4 === 0 ? "אוכל מעולה, הגיע חם!" : "שירות סבבה, ימשיכו ככה",
              status: "visible",
              createdAt: new Date(deliveredAt.getTime() + DAY),
            },
          });
        }
      }
    }
  }

  console.log(`✓ Seeded tenant '${tenant.slug}' with ${items.length} items, demo orders + reviews + couriers.`);
  console.log("  Merchant login: owner@pizzeria-verde.local / verde1234");
  console.log("  Admin login:    admin@quickfood.local       / admin1234");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
