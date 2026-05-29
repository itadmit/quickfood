/**
 * Reset demo tenant — wipe all orders + reset couriers, keep menu/settings.
 * Run with:  set -a && source .env.local && set +a && npx tsx scripts/reset-demo-store.ts
 */
import { prisma } from "@/lib/db/client";

const SLUG = "pizzeria-verde";

async function main() {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: SLUG },
    select: { id: true, name: true },
  });
  if (!tenant) {
    console.error(`Tenant "${SLUG}" not found`);
    process.exit(1);
  }
  console.log(`Resetting tenant ${tenant.name} (${tenant.id})`);

  const ordersBefore = await prisma.order.count({ where: { tenantId: tenant.id } });
  const cartsBefore = await prisma.cart.count({ where: { tenantId: tenant.id } });
  const couriersBefore = await prisma.courier.count({ where: { tenantId: tenant.id } });

  console.log(
    `Before: orders=${ordersBefore}  carts=${cartsBefore}  couriers=${couriersBefore}`,
  );

  await prisma.$transaction([
    prisma.order.deleteMany({ where: { tenantId: tenant.id } }),
    prisma.cart.deleteMany({ where: { tenantId: tenant.id } }),
    prisma.courier.updateMany({
      where: { tenantId: tenant.id, active: true },
      data: {
        status: "offline",
        deliveriesToday: 0,
        cashOnHand: 0,
        currentOrderId: null,
        currentLat: null,
        currentLng: null,
      },
    }),
  ]);

  const ordersAfter = await prisma.order.count({ where: { tenantId: tenant.id } });
  const couriers = await prisma.courier.findMany({
    where: { tenantId: tenant.id, active: true },
    select: { name: true, email: true, pinHash: true },
  });
  console.log(`After:  orders=${ordersAfter}`);
  console.log("Couriers (still here, reset to offline):");
  for (const c of couriers) {
    console.log(
      `  - ${c.name.padEnd(20)}  email=${c.email ?? "<missing>"}  pinHash=${c.pinHash ? "<set>" : "<missing>"}`,
    );
  }

  await prisma.$disconnect();
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
