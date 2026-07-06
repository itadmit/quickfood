import { prisma } from "@/lib/db/client";
import { TenantsList } from "./TenantsList";

export const dynamic = "force-dynamic";

export default async function TenantsListPage() {
  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      plan: { select: { name: true } },
      _count: {
        select: {
          orders: true,
          branches: true,
          menuItems: true,
          menuCategories: true,
        },
      },
      woltImports: {
        where: { committedAt: { not: null } },
        select: { committedAt: true, itemsImported: true },
        orderBy: { committedAt: "desc" },
        take: 1,
      },
      merchantUsers: {
        select: { lastLoginAt: true, emailVerifiedAt: true, role: true, phone: true, email: true },
      },
      orders: {
        select: { createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  const rows = tenants.map((t) => ({
    id: t.id,
    slug: t.slug,
    name: t.name,
    status: t.status,
    themeId: t.themeId,
    cuisineType: t.cuisineType,
    plan: t.plan?.name ?? null,
    // A live base subscription id means they're currently paying — the billing
    // webhook clears it on cancellation, so it's an accurate "paying" signal.
    isPaying: !!t.billingSubscriptionId,
    trialEndsAt: t.trialEndsAt?.toISOString() ?? null,
    ordersCount: t._count.orders,
    branchesCount: t._count.branches,
    menuItemsCount: t._count.menuItems,
    menuCategoriesCount: t._count.menuCategories,
    woltCommittedAt: t.woltImports[0]?.committedAt?.toISOString() ?? null,
    woltItemsImported: t.woltImports[0]?.itemsImported ?? 0,
    signupImportMethod: t.signupImportMethod,
    lastLoginAt:
      t.merchantUsers
        .map((u) => u.lastLoginAt)
        .filter((d): d is Date => !!d)
        .sort((a, b) => b.getTime() - a.getTime())[0]
        ?.toISOString() ?? null,
    ownerVerified: t.merchantUsers.some(
      (u) => u.role === "owner" && !!u.emailVerifiedAt,
    ),
    ownerPhone:
      t.merchantUsers.find((u) => u.role === "owner" && u.phone)?.phone ??
      t.merchantUsers.find((u) => u.phone)?.phone ??
      null,
    ownerEmail:
      t.merchantUsers.find((u) => u.role === "owner")?.email ??
      t.merchantUsers[0]?.email ??
      null,
    lastOrderAt: t.orders[0]?.createdAt.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
  }));

  // Mark owner phones that completed an SMS OTP (a used otp_code row). The
  // signup OTP stores the phone in the same E.164 form as MerchantUser.phone,
  // so a direct `in` match is enough.
  const phones = [...new Set(rows.map((r) => r.ownerPhone).filter((p): p is string => !!p))];
  const verifiedOtp = phones.length
    ? await prisma.otpCode.findMany({
        where: { phone: { in: phones }, usedAt: { not: null } },
        select: { phone: true },
        distinct: ["phone"],
      })
    : [];
  const verifiedPhones = new Set(verifiedOtp.map((o) => o.phone));

  return (
    <TenantsList
      tenants={rows.map((r) => ({
        ...r,
        ownerPhoneVerified: !!r.ownerPhone && verifiedPhones.has(r.ownerPhone),
      }))}
    />
  );
}
