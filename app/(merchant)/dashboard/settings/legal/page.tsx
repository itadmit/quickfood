import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { buildDefaultTerms } from "@/lib/legal/terms";
import { SettingsHeader } from "../SettingsHeader";
import { LegalTermsForm } from "./LegalTermsForm";

export const dynamic = "force-dynamic";

export default async function LegalSettingsPage() {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }

  const [tenant, branch] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: session.tenantId },
      select: { id: true, name: true, slug: true, vatNumber: true, termsText: true, termsAcknowledgedAt: true },
    }),
    prisma.branch.findFirst({
      where: { tenantId: session.tenantId, isPrimary: true },
      select: { address: true, phone: true, email: true, zones: { where: { active: true }, select: { id: true } } },
    }),
  ]);
  if (!tenant) redirect("/dashboard/login");

  const defaultText = buildDefaultTerms({
    businessName: tenant.name,
    vatNumber: tenant.vatNumber,
    address: branch?.address ?? null,
    phone: branch?.phone ?? null,
    email: branch?.email ?? null,
    supportsDelivery: (branch?.zones?.length ?? 0) > 0,
  });

  return (
    <div className="space-y-5">
      <SettingsHeader subtitle="תקנון ותנאי שימוש" />
      <LegalTermsForm
        slug={tenant.slug}
        termsText={tenant.termsText}
        defaultText={defaultText}
        acknowledgedAt={tenant.termsAcknowledgedAt?.toISOString() ?? null}
      />
    </div>
  );
}
