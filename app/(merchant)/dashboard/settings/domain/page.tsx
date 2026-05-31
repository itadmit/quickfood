import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { SettingsHeader } from "../SettingsHeader";
import { DomainForm } from "./DomainForm";
import type { CustomDomainStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function DomainSettingsPage() {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: {
      slug: true,
      customDomain: true,
      customDomainStatus: true,
      customDomainVerification: true,
      customDomainConfig: true,
      customDomainAddedAt: true,
      customDomainVerifiedAt: true,
      customDomainLastError: true,
    },
  });
  if (!tenant) redirect("/dashboard/login");

  return (
    <div className="space-y-5">
      <SettingsHeader subtitle="חיבור דומיין מותאם אישית לחנות שלך" />
      <DomainForm
        slug={tenant.slug}
        initial={{
          domain: tenant.customDomain,
          status: tenant.customDomainStatus as CustomDomainStatus,
          added_at: tenant.customDomainAddedAt?.toISOString() ?? null,
          verified_at: tenant.customDomainVerifiedAt?.toISOString() ?? null,
          last_error: tenant.customDomainLastError,
        }}
      />
    </div>
  );
}
