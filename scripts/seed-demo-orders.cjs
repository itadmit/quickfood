const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const TENANT = "6fdb7a8e-c00a-4f10-b5ef-94aa26e00736";
const BRANCH = "23d7d0bc-189b-4294-a049-aa2d18280c11";

// real menu items (id, name, price ₪)
const M = {
  mishel:   ["4c397577-032d-486f-bdb7-79ac27f88a53", "מיכלאנג׳לו", 43],
  rafael:   ["96a9af46-8e24-465a-a1eb-27c7f8ab27f6", "רפאל", 43],
  leonardo: ["0bf1f262-b875-479a-8cf5-012cebe9ab39", "לאונרדו", 40],
  donatelo: ["37fc1505-1329-4551-8404-7e560d7ac27c", "דונטלו", 38],
  baby:     ["51d52997-5c45-4158-8abb-ba68ce7e97d5", "בייבי נינג׳ה", 38],
  pesto:    ["f175e426-f21d-49b5-9a70-09bea8c47dcf", "פיצה פסטו עגבנייה ובצל", 38],
  alfredoP: ["a862526f-afba-4bac-a721-ed74c857020e", "פיצה לבנה ברוטב שמנת אלפרדו", 38],
  vegan:    ["d64f37a4-b3ab-49aa-a85a-cf0a7b014131", "פיצה טבעונית", 37],
  family:   ["a0112ad5-6ab6-40d8-833e-154642d9e045", "דיל משפחתי", 62],
  couple:   ["04a5f7b7-85a6-4a4b-9313-4a54a1ce82d9", "דיל זוגי - פיצה+שתייה", 35],
  dealPasta:["d8ac8bce-405a-40c7-b283-7911c8dafcc1", "דיל יחיד - פסטה/רביולי + שתייה", 42],
  ravGvina: ["f92d2027-509a-43bf-b3f4-1d78b3309cdf", "רביולי גבינה ברוטב שמנת אלפרדו", 37],
  rosa:     ["579deda0-7df9-4425-9bfd-947679bb3c0e", "פסטה פנה ברוטב רוזה", 37],
  alfredo:  ["31c2e881-bb75-49fe-bd0e-3fafd65bef8d", "פסטה פנה ברוטב אלפרדו", 37],
  ravBatata:["dfbc1da1-18ac-436d-8807-55322088e26f", "רביולי בטטה ברוטב שמנת אלפרדו", 37],
  garlic:   ["a5dc22b7-177b-45eb-847e-41595e17c522", "לחם שום קלאסי", 20],
  garlicIt: ["922538cc-e0fc-424d-b203-01696c79c30d", "לחם שום איטלקי ג. צהובה ובולגרית", 30],
  fries:    ["1a1f4101-a852-43f9-a9a5-d6a16b2a983c", "ציפס", 18],
  onion:    ["32a35107-4ba2-4987-aeba-6f7488b70e8c", "טבעות בצל", 18],
  cola:     ["04fd6e24-d6cd-4847-b53d-6ced8b9f9e59", "קוקה קולה - גדול", 13],
  zero:     ["c94c0961-24ce-469f-bb6d-074016fd6cfa", "קולה זירו - גדול", 13],
  sprite:   ["507c1535-3ffe-4284-930c-801a7aa8dabd", "ספרייט - גדול", 13],
  canCola:  ["a16c472d-6948-43b6-a1d4-1b1fcb1c9302", "פחית קוקה קולה", 8],
  water:    ["2e63562e-70e1-4dae-8feb-646679bbc4e8", "מים מינרליים נביעות", 8],
  waffle:   ["c3b19556-acdf-4811-8ddd-abc66723cfc0", "וופל בלגי בתוספת שוקולד לבן+חום", 30],
  malabi:   ["43bca845-95ff-4825-b72a-c4956ad8b2c4", "מלבי שמנת", 10],
  choco:    ["0aaf648e-7a10-4e4d-a15c-4ff1ba3a0fd7", "פיצה שוקולד", 25],
};

const it = (key, qty = 1) => ({ id: M[key][0], name: M[key][1], price: M[key][2], qty });

// (firstName, lastName, phone)
const C = [
  ["דניאל", "לוי", "0524567891"], ["מאיה", "כהן", "0539876543"],
  ["יוסי", "פרץ", "0501234567"], ["נועה", "ביטון", "0547778899"],
  ["איתי", "אברהם", "0526665544"], ["שירה", "דהן", "0533219876"],
  ["אבי", "מזרחי", "0509998877"], ["תמר", "פרידמן", "0541112233"],
  ["רון", "שפירא", "0528887766"], ["ליאת", "אזולאי", "0535554433"],
  ["עומר", "נחמיאס", "0507776655"], ["הדר", "גולן", "0543334455"],
  ["ניר", "חדד", "0521119988"], ["רותם", "סגל", "0538882277"],
  ["גיא", "ישראלי", "0506663344"], ["אורי", "בן דוד", "0549995511"],
];

// day: "2026-06-29" (yesterday) | "2026-06-30" (today). time local IDT (+03:00).
const ORDERS = [
  // ---- yesterday 29.6 ----
  { c: 0, day: "2026-06-29", t: "12:15", method: "delivery", pay: "card", items: [it("mishel"), it("garlic"), it("cola")] },
  { c: 1, day: "2026-06-29", t: "12:50", method: "pickup",   pay: "cash", items: [it("couple"), it("fries")] },
  { c: 2, day: "2026-06-29", t: "13:30", method: "delivery", pay: "bit",  items: [it("family"), it("garlicIt"), it("sprite", 2)] },
  { c: 3, day: "2026-06-29", t: "18:10", method: "delivery", pay: "card", items: [it("rafael"), it("rosa"), it("cola")], src: "ai_advisor" },
  { c: 4, day: "2026-06-29", t: "18:45", method: "delivery", pay: "card", items: [it("leonardo"), it("onion"), it("zero")] },
  { c: 5, day: "2026-06-29", t: "19:20", method: "pickup",   pay: "cash", items: [it("donatelo"), it("malabi")] },
  { c: 6, day: "2026-06-29", t: "19:55", method: "delivery", pay: "bit",  items: [it("family"), it("waffle"), it("cola"), it("sprite")] },
  { c: 7, day: "2026-06-29", t: "20:30", method: "delivery", pay: "card", items: [it("ravGvina"), it("garlic"), it("water")] },
  { c: 8, day: "2026-06-29", t: "21:05", method: "delivery", pay: "card", items: [it("mishel", 2), it("fries"), it("zero", 2)] },
  { c: 9, day: "2026-06-29", t: "21:40", method: "pickup",   pay: "cash", items: [it("pesto"), it("choco")] },
  // ---- today 30.6 morning ----
  { c: 10, day: "2026-06-30", t: "09:15", method: "delivery", pay: "card", items: [it("dealPasta"), it("canCola")] },
  { c: 11, day: "2026-06-30", t: "09:50", method: "pickup",   pay: "cash", items: [it("alfredoP"), it("garlic")] },
  { c: 12, day: "2026-06-30", t: "10:25", method: "delivery", pay: "bit",  items: [it("rafael"), it("ravBatata"), it("cola")], src: "reorder" },
  { c: 13, day: "2026-06-30", t: "11:00", method: "delivery", pay: "card", items: [it("family"), it("onion"), it("sprite", 2)] },
  { c: 14, day: "2026-06-30", t: "11:35", method: "pickup",   pay: "cash", items: [it("vegan"), it("water")] },
  { c: 15, day: "2026-06-30", t: "12:05", method: "delivery", pay: "card", items: [it("leonardo"), it("alfredo"), it("waffle"), it("zero")] },
];

function at(day, time, addMin = 0) {
  const d = new Date(`${day}T${time}:00+03:00`);
  return new Date(d.getTime() + addMin * 60000);
}

(async () => {
  // continue numbering after the current max PG-n
  const existing = await prisma.order.findMany({
    where: { tenantId: TENANT, number: { startsWith: "PG-" } },
    select: { number: true },
  });
  let next = existing.reduce((mx, o) => {
    const n = parseInt(o.number.replace("PG-", ""), 10);
    return Number.isFinite(n) && n > mx ? n : mx;
  }, 0) + 1;

  let created = 0;
  for (const o of ORDERS) {
    const [fn, ln, phone] = C[o.c];
    const deliveryFee = o.method === "delivery" ? 15 : 0;
    const subtotal = o.items.reduce((s, i) => s + i.price * i.qty, 0);
    const total = subtotal + deliveryFee;
    const createdAt = at(o.day, o.t);
    const number = `PG-${next++}`;

    await prisma.order.create({
      data: {
        number,
        tenantId: TENANT,
        branchId: BRANCH,
        status: "delivered",
        method: o.method,
        source: o.src || "direct",
        subtotal,
        deliveryFee,
        total,
        paymentMethod: o.pay,
        paymentStatus: "paid",
        customerFirstNameSnap: fn,
        customerLastNameSnap: ln,
        customerPhoneSnap: phone,
        createdAt,
        confirmedAt: at(o.day, o.t, 1),
        preparingAt: at(o.day, o.t, 3),
        readyAt: at(o.day, o.t, 18),
        deliveredAt: at(o.day, o.t, o.method === "delivery" ? 38 : 20),
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
    created++;
    console.log(`${number}  ${o.day} ${o.t}  ${fn} ${ln}  ${o.method}  ₪${total}`);
  }
  // keep the tenant's order-number counter ahead of what we seeded, so the
  // app's next real order doesn't collide on (tenant_id, number).
  await prisma.tenant.update({ where: { id: TENANT }, data: { nextOrderNumber: next } });
  console.log(`\nDONE: created ${created} orders. nextOrderNumber=${next}`);
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
