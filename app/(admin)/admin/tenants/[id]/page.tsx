import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { TenantDetail } from "./TenantDetail";

export const dynamic = "force-dynamic";

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: {
      plan: { select: { name: true } },
      branches: {
        select: {
          id: true,
          name: true,
          address: true,
          phone: true,
          isPrimary: true,
        },
        orderBy: { createdAt: "asc" },
      },
      merchantUsers: {
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          lastLoginAt: true,
          emailVerifiedAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      },
      _count: { select: { orders: true, campaigns: true, smsLogs: true } },
    },
  });
  if (!tenant) notFound();

  return (
    <TenantDetail
      initial={{
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        status: tenant.status,
        themeId: tenant.themeId,
        businessType: tenant.businessType,
        cuisineType: tenant.cuisineType,
        vatNumber: tenant.vatNumber,
        customDomain: tenant.customDomain,
        acceptsCash: tenant.acceptsCash,
        kioskEnabled: tenant.kioskEnabled,
        smsCreditsRemaining: tenant.smsCreditsRemaining,
        whatsappCreditsRemaining: tenant.whatsappCreditsRemaining,
        whatsappToken: tenant.whatsappToken,
        whatsappInstanceId: tenant.whatsappInstanceId,
        plan: tenant.plan?.name ?? null,
        billingSetupCompletedAt:
          tenant.billingSetupCompletedAt?.toISOString() ?? null,
        trialEndsAt: tenant.trialEndsAt?.toISOString() ?? null,
        createdAt: tenant.createdAt.toISOString(),
        counts: {
          orders: tenant._count.orders,
          campaigns: tenant._count.campaigns,
          smsLogs: tenant._count.smsLogs,
          branches: tenant.branches.length,
        },
        branches: tenant.branches,
        users: tenant.merchantUsers.map((u) => ({
          id: u.id,
          email: u.email,
          name: u.name,
          phone: u.phone,
          role: u.role,
          lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
          emailVerifiedAt: u.emailVerifiedAt?.toISOString() ?? null,
          createdAt: u.createdAt.toISOString(),
        })),
      }}
    />
  );
}
