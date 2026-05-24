"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IcoCreditCard, IcoArrowLeft } from "@/components/shared/Icons";

/**
 * Inline banner above the merchant topbar surfacing the billing-setup gap.
 *
 * Three visible states (none of which appear once a payment method is saved):
 *   1. trial active        — yellow banner: "ניסיון פעיל — נותרו X ימים"
 *   2. trial near end (≤2) — same banner, more urgent copy
 *   3. trial expired       — full-screen TrialGate kicks in elsewhere; this
 *                            banner stays out of the way to avoid duplicate UI
 *
 * Hidden on /dashboard/billing — that's where the merchant goes to act.
 */
export function BillingSetupBanner({
  hasPaymentMethod,
  trialDaysLeft,
  trialExpired,
}: {
  hasPaymentMethod: boolean;
  trialDaysLeft: number | null;
  trialExpired: boolean;
}) {
  const pathname = usePathname() ?? "";
  if (hasPaymentMethod) return null;
  if (pathname.startsWith("/dashboard/billing")) return null;
  // After expiry the TrialGate full-screen lock takes over — no need to also
  // show a banner.
  if (trialExpired) return null;

  const urgent = trialDaysLeft !== null && trialDaysLeft <= 2;
  const headline =
    trialDaysLeft === null
      ? "החשבון טרם הופעל."
      : trialDaysLeft === 0
        ? "תקופת הניסיון מסתיימת היום."
        : trialDaysLeft === 1
          ? "תקופת הניסיון מסתיימת מחר."
          : `נותרו ${trialDaysLeft} ימים בתקופת הניסיון.`;
  const body =
    trialDaysLeft === null
      ? "לא נשמר אמצעי תשלום. השלם את פרטי החיוב כדי להפעיל את המנוי."
      : "השלם פתיחת מנוי כדי להמשיך להשתמש במערכת אחרי תום הניסיון ולפתוח רכישת חבילות SMS.";

  // The `qf-billing-banner` / `qf-billing-cta` class hooks let
  // globals.css repaint the banner under .dash-v2 with the V2 brand
  // (yellow surface, black border, black CTA) without forking the JSX.
  return (
    <div
      className={
        urgent
          ? "qf-billing-banner qf-billing-banner-urgent bg-qf-tomato-soft border-b border-qf-tomato/40"
          : "qf-billing-banner bg-qf-yolk-soft border-b border-qf-yolk/40"
      }
    >
      <div className="px-6 py-2.5 flex items-center gap-3 text-sm text-qf-ink">
        <div
          className={
            urgent
              ? "qf-billing-icon w-7 h-7 rounded-full bg-qf-tomato/20 grid place-items-center shrink-0"
              : "qf-billing-icon w-7 h-7 rounded-full bg-qf-yolk/30 grid place-items-center shrink-0"
          }
        >
          <IcoCreditCard c={urgent ? "#c2421f" : "var(--qf-deep)"} s={14} />
        </div>
        <div className="flex-1 min-w-0">
          <span className="font-medium">{headline}</span>{" "}
          <span className="text-qf-ink2">{body}</span>
        </div>
        <Link
          href="/dashboard/billing"
          className="qf-billing-cta inline-flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-lg bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-xs font-medium"
        >
          השלמת תשלום
          <IcoArrowLeft c="currentColor" s={12} />
        </Link>
      </div>
    </div>
  );
}
