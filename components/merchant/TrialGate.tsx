"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IcoCreditCard, IcoArrowLeft } from "@/components/shared/Icons";

/**
 * Full-screen lock that takes over the dashboard when the local 7-day trial
 * has expired and the merchant hasn't saved a payment method yet. Allowed to
 * pass through on /dashboard/billing so the merchant can complete payment.
 *
 * Rendered inside the dashboard layout, sibling to the page content; when
 * locked, it covers the rest of the layout with a fixed overlay.
 */
export function TrialGate({
  trialExpired,
  hasPaymentMethod,
}: {
  trialExpired: boolean;
  hasPaymentMethod: boolean;
}) {
  const pathname = usePathname() ?? "";

  // No lock when the merchant has a payment method, regardless of trial state.
  if (hasPaymentMethod) return null;
  // No lock during the active trial.
  if (!trialExpired) return null;
  // Always let the billing page through so the merchant can pay.
  if (pathname.startsWith("/dashboard/billing")) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm grid place-items-center p-4">
      <div className="bg-white rounded-3xl shadow-xl max-w-md w-full p-6 text-center">
        <div className="mx-auto w-14 h-14 rounded-full bg-qf-yolk/30 grid place-items-center mb-4">
          <IcoCreditCard c="var(--qf-deep)" s={24} />
        </div>
        <h2 className="text-xl font-bold">תקופת הניסיון הסתיימה</h2>
        <p className="text-sm text-qf-ink2 mt-2 leading-relaxed">
          כדי להמשיך להשתמש בדשבורד, באתר ובכל יכולות המערכת — יש להשלים פתיחת מנוי משלם.
        </p>
        <div className="mt-3 text-xs text-qf-mute">
          חיוב חודשי: ₪299 + מע״מ. ניתן לבטל בכל עת.
        </div>
        <Link
          href="/dashboard/billing"
          className="mt-5 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm font-medium"
        >
          השלמת תשלום ופתיחת מנוי
          <IcoArrowLeft c="currentColor" s={14} />
        </Link>
      </div>
    </div>
  );
}
