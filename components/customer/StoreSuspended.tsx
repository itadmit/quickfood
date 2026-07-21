import Link from "next/link";

/**
 * Shown in place of the whole storefront when a store is closed for billing
 * (`Tenant.billingSuspendedAt` set after the hub cancels the base subscription
 * for non-payment, or an admin `status = suspended`). Customers see a neutral
 * "temporarily closed" message; the owner (previewing) gets a direct link to
 * fix their payment method in the dashboard.
 */
export function StoreSuspended({
  tenantName,
  tenantLogoUrl,
  isOwner,
}: {
  tenantName: string;
  tenantLogoUrl: string | null;
  isOwner: boolean;
}) {
  const initial = tenantName.slice(0, 1);
  return (
    <div className="min-h-screen grid place-items-center px-6 py-16 bg-qf-bg">
      <div className="w-full max-w-sm text-center">
        <div
          className="mx-auto w-16 h-16 rounded-full overflow-hidden grid place-items-center shadow-sm"
          style={{ backgroundColor: "var(--qf-primary)" }}
        >
          {tenantLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tenantLogoUrl} alt={tenantName} className="w-full h-full object-cover" />
          ) : (
            <span className="text-white font-bold text-2xl">{initial}</span>
          )}
        </div>
        <h1 className="mt-5 text-xl font-bold text-qf-ink">{tenantName}</h1>
        <p className="mt-2 text-sm text-qf-ink2">
          החנות סגורה זמנית ואינה מקבלת הזמנות כרגע.
        </p>

        {isOwner && (
          <div className="mt-6 rounded-2xl border border-qf-line bg-white p-4 text-sm text-qf-ink2">
            <p className="font-medium text-qf-ink">המנוי שלך אינו פעיל</p>
            <p className="mt-1">
              החנות תיפתח אוטומטית ברגע שיתקבל תשלום. עדכנו אמצעי תשלום כדי
              להפעיל אותה מחדש.
            </p>
            <Link
              href="/dashboard/billing"
              className="mt-3 inline-flex items-center justify-center rounded-xl bg-(--qf-primary) px-4 h-11 text-white font-semibold"
            >
              עדכון אמצעי תשלום
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
