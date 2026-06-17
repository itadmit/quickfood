"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle } from "lucide-react";

/**
 * Hard gate shown across the dashboard until the merchant explicitly reviews
 * and approves their storefront terms (תקנון). Suppressed on the terms editor
 * itself so they can actually reach the approve button. Approving shifts
 * content liability to the merchant - they confirm they own the text.
 */
export function TermsAckGate({
  acknowledged,
}: {
  acknowledged: boolean;
}) {
  const pathname = usePathname() || "";
  if (acknowledged) return null;
  if (pathname.startsWith("/dashboard/settings/legal")) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 w-10 h-10 rounded-full bg-qf-yolk-soft flex items-center justify-center shrink-0">
            <AlertTriangle size={20} className="text-qf-ink2" />
          </div>
          <div>
            <h2 className="font-bold text-lg">צריך לאשר את התקנון של החנות</h2>
            <p className="text-sm text-qf-ink2 mt-1.5 leading-relaxed">
              הכנו עבורך נוסח תקנון אוטומטי לחנות, לפי פרטי העסק שלך - דרישה של
              חברת הסליקה. <span className="font-semibold text-qf-ink">האחריות
              לתוכן התקנון היא עליך:</span> עליך לעבור עליו, להתאים אותו לפעילות
              העסק ולוודא שהוא תואם את הדין. QuickFood מספקת נוסח בסיס בלבד ואינה
              אחראית לתוכן.
            </p>
            <p className="text-sm text-qf-ink2 mt-2 leading-relaxed">
              כדי להמשיך לנהל את החנות יש לפתוח את התקנון, לעבור עליו ולאשר אותו.
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/settings/legal"
          className="block w-full text-center px-4 py-3 rounded-xl bg-qf-ink text-white text-sm font-semibold hover:opacity-90"
        >
          לצפייה ואישור התקנון
        </Link>
      </div>
    </div>
  );
}
