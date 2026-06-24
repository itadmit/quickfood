import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { resolveTenantBySlug } from "@/lib/slug";
import { getCustomerLoyalty } from "@/lib/loyalty/customer";
import { ProfileLoggedIn } from "./ProfileLoggedIn";
import { ProfileLogin } from "./ProfileLogin";
import { BottomTabBar } from "@/components/customer/BottomTabBar";
import { IcoChev } from "@/components/shared/Icons";

export const dynamic = "force-dynamic";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const tenant = await resolveTenantBySlug(tenantSlug);
  if (!tenant) redirect("/");

  const session = await getSession();
  if (!session || session.type !== "customer") {
    return (
      <div className="min-h-screen pb-24 lg:pb-12">
        <header className="px-5 pt-5 pb-3 flex items-center gap-3 bg-white border-b border-qf-line lg:bg-transparent lg:border-0 lg:max-w-md lg:mx-auto lg:px-0 lg:pt-10 lg:pb-2">
          <Link
            href={`/s/${tenantSlug}`}
            className="w-9 h-9 rounded-full border border-qf-line grid place-items-center lg:hidden"
            aria-label="חזרה"
          >
            <IcoChev s={18} />
          </Link>
          <h1 className="font-bold text-lg lg:text-2xl">התחברות</h1>
        </header>
        <ProfileLogin />
        <BottomTabBar tenantSlug={tenantSlug} />
      </div>
    );
  }

  const [customer, orders] = await Promise.all([
    prisma.customer.findUnique({
      where: { id: session.userId },
      select: { id: true, firstName: true, lastName: true, phone: true, email: true, createdAt: true },
    }),
    prisma.order.findMany({
      where: { customerId: session.userId, tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, number: true, status: true, total: true, createdAt: true },
    }),
  ]);

  if (!customer) {
    return (
      <div className="min-h-screen pb-24">
        <ProfileLogin />
        <BottomTabBar tenantSlug={tenantSlug} />
      </div>
    );
  }

  const loyalty = await getCustomerLoyalty(tenant.id, customer.id);

  return (
    <div className="min-h-screen pb-24">
      <ProfileLoggedIn
        tenantSlug={tenantSlug}
        loyalty={loyalty}
        customer={{
          id: customer.id,
          firstName: customer.firstName,
          lastName: customer.lastName,
          phone: customer.phone,
          email: customer.email,
          createdAt: customer.createdAt.toISOString(),
        }}
        orders={orders.map((o) => ({
          id: o.id,
          number: o.number,
          status: o.status,
          total: o.total,
          createdAt: o.createdAt.toISOString(),
        }))}
      />
      <BottomTabBar tenantSlug={tenantSlug} />
    </div>
  );
}
