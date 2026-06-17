import Link from "next/link";
import { AlertTriangle } from "lucide-react";

/**
 * Persistent top-bar reminder that the merchant hasn't approved their
 * storefront terms yet. Complements the blocking TermsAckGate modal (which
 * is suppressed for brand-new empty stores) so the reminder is never missed.
 */
export function TermsAckBanner({ acknowledged }: { acknowledged: boolean }) {
  if (acknowledged) return null;

  return (
    <div className="qf-billing-banner bg-qf-yolk-soft border-b border-qf-yolk/40">
      <div className="px-4 sm:px-6 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3 text-sm text-qf-ink">
        <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
          <div className="qf-billing-icon w-7 h-7 rounded-full bg-qf-yolk/30 grid place-items-center shrink-0">
            <AlertTriangle size={14} color="var(--qf-deep)" strokeWidth={2.2} />
          </div>
          <div className="flex-1 min-w-0 leading-snug">
            <span className="font-medium">
              התקנון שהחנות שלך מציגה ללקוחות עדיין לא אושר על ידך.
            </span>{" "}
            <span className="text-qf-ink2">
              הכנו עבורך נוסח מוכן. עברו עליו, התאימו אותו לעסק ואשרו שאתם אחראים
              לתוכן (נדרש גם על ידי חברת הסליקה).
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 self-stretch sm:self-auto ps-10 sm:ps-0">
          <Link
            href="/dashboard/settings/legal"
            className="qf-billing-cta inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-xs font-medium flex-1 sm:flex-none whitespace-nowrap"
          >
            לצפייה ואישור התקנון
          </Link>
        </div>
      </div>
    </div>
  );
}
