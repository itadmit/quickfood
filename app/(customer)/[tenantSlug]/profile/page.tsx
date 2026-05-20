import Link from "next/link";
import { IcoChev } from "@/components/shared/Icons";
import { BottomTabBar } from "@/components/customer/BottomTabBar";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  return (
    <div className="min-h-screen pb-24">
      <header className="px-5 pt-5 pb-3 flex items-center gap-3 bg-white border-b border-qf-line">
        <Link
          href={`/${tenantSlug}`}
          className="w-9 h-9 rounded-full border border-qf-line grid place-items-center"
          aria-label="חזרה"
        >
          <IcoChev s={18} />
        </Link>
        <h1 className="font-bold text-lg">אזור אישי</h1>
      </header>

      <div className="px-5 py-10 text-center">
        <div className="text-qf-mute mb-4">
          התחברות עם טלפון, היסטוריית הזמנות וכתובות שמורות — בקרוב.
        </div>
        <Link
          href={`/${tenantSlug}/menu`}
          className="inline-block px-4 py-2 rounded-full bg-(--qf-primary) text-white text-sm"
        >
          חזרה לתפריט
        </Link>
      </div>

      <BottomTabBar tenantSlug={tenantSlug} />
    </div>
  );
}
