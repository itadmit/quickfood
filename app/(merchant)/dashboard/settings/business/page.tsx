import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { SettingsTabs } from "../SettingsTabs";
import { BusinessForm } from "./BusinessForm";

export const dynamic = "force-dynamic";

export default async function BusinessSettingsPage() {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }
  const [tenant, branch] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: session.tenantId },
      select: { vatNumber: true },
    }),
    prisma.branch.findFirst({
      where: { tenantId: session.tenantId, isPrimary: true },
    }),
  ]);
  if (!tenant || !branch) redirect("/dashboard/login");

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">הגדרות</h1>
        <p className="text-sm text-qf-mute">פרטי עסק וסניף ראשי</p>
      </header>
      <SettingsTabs />
      <BusinessForm
        branchId={branch.id}
        initial={{
          name: branch.name,
          address: branch.address,
          phone: branch.phone,
          email: branch.email ?? "",
          minOrder: branch.minOrder,
          deliveryFee: branch.deliveryFee,
          serviceFee: branch.serviceFee,
          vatNumber: tenant.vatNumber ?? "",
        }}
      />
    </div>
  );
}
