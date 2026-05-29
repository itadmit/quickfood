import { prisma } from "../lib/db/client";

async function main() {
  const tenants = await prisma.tenant.findMany({
    select: { id: true, slug: true, name: true, reviewsEnabled: true, reviewsChannel: true },
    take: 20,
  });
  console.log("tenants:", tenants);

  const orders = await prisma.order.findMany({
    where: { customerId: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      number: true,
      status: true,
      customerId: true,
      tenant: { select: { slug: true, name: true } },
      customer: { select: { firstName: true, email: true, phone: true } },
      review: { select: { id: true, rating: true } },
      reviewPromptDismissedAt: true,
      createdAt: true,
    },
  });
  console.log("orders:");
  for (const o of orders) {
    console.log(JSON.stringify(o, null, 2));
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).then(() => process.exit(0));
