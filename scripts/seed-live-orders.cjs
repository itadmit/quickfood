const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const TENANT = "6fdb7a8e-c00a-4f10-b5ef-94aa26e00736";
const BRANCH = "23d7d0bc-189b-4294-a049-aa2d18280c11";

const M = {
  mishel:   ["4c397577-032d-486f-bdb7-79ac27f88a53", "מיכלאנג׳לו", 43],
  rafael:   ["96a9af46-8e24-465a-a1eb-27c7f8ab27f6", "רפאל", 43],
  leonardo: ["0bf1f262-b875-479a-8cf5-012cebe9ab39", "לאונרדו", 40],
  donatelo: ["37fc1505-1329-4551-8404-7e560d7ac27c", "דונטלו", 38],
  family:   ["a0112ad5-6ab6-40d8-833e-154642d9e045", "דיל משפחתי", 62],
  couple:   ["04a5f7b7-85a6-4a4b-9313-4a54a1ce82d9", "דיל זוגי - פיצה+שתייה", 35],
  rosa:     ["579deda0-7df9-4425-9bfd-947679bb3c0e", "פסטה פנה ברוטב רוזה", 37],
  ravGvina: ["f92d2027-509a-43bf-b3f4-1d78b3309cdf", "רביולי גבינה ברוטב שמנת אלפרדו", 37],
  garlic:   ["a5dc22b7-177b-45eb-847e-41595e17c522", "לחם שום קלאסי", 20],
  fries:    ["1a1f4101-a852-43f9-a9a5-d6a16b2a983c", "ציפס", 18],
  onion:    ["32a35107-4ba2-4987-aeba-6f7488b70e8c", "טבעות בצל", 18],
  cola:     ["04fd6e24-d6cd-4847-b53d-6ced8b9f9e59", "קוקה קולה - גדול", 13],
  sprite:   ["507c1535-3ffe-4284-930c-801a7aa8dabd", "ספרייט - גדול", 13],
  waffle:   ["c3b19556-acdf-4811-8ddd-abc66723cfc0", "וופל בלגי בתוספת שוקולד לבן+חום", 30],
};
const it = (k, qty = 1) => ({ id: M[k][0], name: M[k][1], price: M[k][2], qty });

const C = [
  ["אורן", "כץ", "0526112233"], ["יעל", "שמש", "0539221144"],
  ["דור", "מלכה", "0507334455"], ["שני", "אוחיון", "0548445566"],
  ["איל", "ברק", "0525556677"], ["נטע", "רוזן", "0536667788"],
  ["טל", "אביב", "0507778891"], ["מור", "חזן", "0549990022"],
];

// status → which Kanban column. ago = minutes before "now".
const ORDERS = [
  // חדשות (pending)
  { c: 0, status: "pending",          method: "delivery", pay: "card", ago: 3,  items: [it("mishel"), it("garlic"), it("cola")] },
  { c: 1, status: "pending",          method: "pickup",   pay: "cash", ago: 6,  items: [it("couple"), it("fries")] },
  { c: 2, status: "pending",          method: "delivery", pay: "bit",  ago: 9,  items: [it("family"), it("sprite", 2)] },
  // בהכנה (preparing / in_oven)
  { c: 3, status: "preparing",        method: "delivery", pay: "card", ago: 13, items: [it("rafael"), it("rosa"), it("cola")] },
  { c: 4, status: "in_oven",          method: "delivery", pay: "card", ago: 17, items: [it("leonardo"), it("onion"), it("sprite")] },
  // מוכנות (ready)
  { c: 5, status: "ready",            method: "pickup",   pay: "cash", ago: 24, items: [it("donatelo"), it("waffle")] },
  { c: 6, status: "ready",            method: "delivery", pay: "bit",  ago: 27, items: [it("ravGvina"), it("garlic"), it("cola")] },
  // יצאו למשלוח (out_for_delivery)
  { c: 7, status: "out_for_delivery", method: "delivery", pay: "card", ago: 33, items: [it("family"), it("fries"), it("cola"), it("sprite")] },
];

const now = new Date();
const ago = (min) => new Date(now.getTime() - min * 60000);

(async () => {
  const existing = await prisma.order.findMany({
    where: { tenantId: TENANT, number: { startsWith: "PG-" } },
    select: { number: true },
  });
  let next = existing.reduce((mx, o) => {
    const n = parseInt(o.number.replace("PG-", ""), 10);
    return Number.isFinite(n) && n > mx ? n : mx;
  }, 0) + 1;

  for (const o of ORDERS) {
    const [fn, ln, phone] = C[o.c];
    const deliveryFee = o.method === "delivery" ? 15 : 0;
    const subtotal = o.items.reduce((s, i) => s + i.price * i.qty, 0);
    const total = subtotal + deliveryFee;
    const createdAt = ago(o.ago);
    const number = `PG-${next++}`;

    const st = o.status;
    const has = (cond, val) => (cond ? val : null);
    const t = (off) => ago(o.ago - off);
    const active = ["confirmed", "preparing", "in_oven", "ready", "out_for_delivery"].includes(st);
    const prepping = ["preparing", "in_oven", "ready", "out_for_delivery"].includes(st);
    const isReady = ["ready", "out_for_delivery"].includes(st);
    const outForDelivery = st === "out_for_delivery";

    await prisma.order.create({
      data: {
        number,
        tenantId: TENANT,
        branchId: BRANCH,
        status: st,
        method: o.method,
        source: "direct",
        subtotal,
        deliveryFee,
        total,
        paymentMethod: o.pay,
        paymentStatus: o.pay === "cash" ? "pending" : "paid",
        customerFirstNameSnap: fn,
        customerLastNameSnap: ln,
        customerPhoneSnap: phone,
        createdAt,
        confirmedAt: has(active, t(1)),
        preparingAt: has(prepping, t(2)),
        readyAt: has(isReady, t(Math.min(12, o.ago - 1))),
        courierPickedUpAt: has(outForDelivery, t(Math.min(14, o.ago - 1))),
        items: {
          create: o.items.map((i) => ({
            menuItemId: i.id,
            nameSnapshot: i.name,
            quantity: i.qty,
            unitPrice: i.price,
            totalPrice: i.price * i.qty,
            source: "menu",
          })),
        },
      },
    });
    console.log(`${number}  ${st.padEnd(16)} ${fn} ${ln}  ${o.method}  ₪${total}`);
  }
  // keep the tenant's order-number counter ahead of what we seeded, so the
  // app's next real order doesn't collide on (tenant_id, number).
  await prisma.tenant.update({ where: { id: TENANT }, data: { nextOrderNumber: next } });
  console.log(`\nDONE: created ${ORDERS.length} live orders. nextOrderNumber=${next}`);
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
