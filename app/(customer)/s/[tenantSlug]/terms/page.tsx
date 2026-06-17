import { notFound } from "next/navigation";
import Link from "next/link";
import { resolveTenantBySlug } from "@/lib/slug";
import { resolveTerms } from "@/lib/legal/terms";
import { LegalText } from "@/components/shared/LegalText";
import { IcoChev } from "@/components/shared/Icons";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const tenant = await resolveTenantBySlug(tenantSlug);
  return { title: tenant ? `תקנון ותנאי שימוש · ${tenant.name}` : "תקנון" };
}

export default async function TermsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const tenant = await resolveTenantBySlug(tenantSlug);
  if (!tenant) notFound();

  const branch = tenant.branches[0];
  const text = resolveTerms(tenant.termsText, {
    businessName: tenant.name,
    vatNumber: tenant.vatNumber,
    address: branch?.address ?? null,
    phone: branch?.phone ?? null,
    email: branch?.email ?? null,
    supportsDelivery: (branch?.zones?.length ?? 0) > 0,
  });

  return (
    <div className="px-4 py-5 lg:max-w-3xl lg:mx-auto lg:px-6 lg:py-8">
      <header className="flex items-center gap-3 mb-4">
        <Link
          href={`/s/${tenantSlug}`}
          className="w-9 h-9 rounded-full border border-qf-line grid place-items-center shrink-0"
          aria-label="חזרה"
        >
          <IcoChev s={18} />
        </Link>
        <h1 className="font-bold text-lg lg:text-3xl">תקנון ותנאי שימוש</h1>
      </header>

      <div className="bg-white rounded-2xl border border-qf-line p-4 lg:p-6">
        <LegalText text={text} />
      </div>
    </div>
  );
}
