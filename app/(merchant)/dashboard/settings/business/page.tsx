import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { SettingsHeader } from "../SettingsHeader";
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
      <SettingsHeader subtitle="פרטי עסק וסניף ראשי" />
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
          busyEtaBoostMinutes: branch.busyEtaBoostMinutes,
          vatNumber: tenant.vatNumber ?? "",
        }}
      />
    </div>
  );
}
