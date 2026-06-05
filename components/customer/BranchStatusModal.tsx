"use client";

import { IcoClock, IcoClose } from "@/components/shared/Icons";

interface BaseProps {
  onClose: () => void;
}

export function BusyAlertModal({
  boostMinutes,
  ctaLabel = "המשך לתפריט",
  onClose,
}: BaseProps & { boostMinutes: number; ctaLabel?: string }) {
  return (
    <Shell aria-labelledby="qf-busy-alert-title" onClose={onClose}>
      <div
        className="w-12 h-12 rounded-full grid place-items-center mx-auto"
        style={{ backgroundColor: "var(--qf-soft)" }}
      >
        <IcoClock s={22} c="var(--qf-deep)" />
      </div>
      <h2
        id="qf-busy-alert-title"
        className="text-xl font-black text-center mt-3"
      >
        אנחנו בעומס
      </h2>
      <p className="text-sm text-qf-ink2 text-center mt-2 leading-relaxed">
        ההזמנה תיקח כ-{boostMinutes} דקות יותר מהרגיל. המטבח עובד במלוא הכוח -
        תודה על הסבלנות!
      </p>
      <button
        type="button"
        onClick={onClose}
        className="mt-5 w-full px-5 py-3 rounded-2xl bg-black text-[#F8CB1E] border-2 border-black font-bold text-sm shadow-[0_3px_0_#000] hover:bg-black/90"
      >
        {ctaLabel}
      </button>
    </Shell>
  );
}

export function ClosedAlertModal({ onClose }: BaseProps) {
  return (
    <Shell aria-labelledby="qf-closed-alert-title" onClose={onClose}>
      <div
        className="w-12 h-12 rounded-full grid place-items-center mx-auto"
        style={{ backgroundColor: "#fdecea" }}
      >
        <IcoClose s={22} c="#c2421f" />
      </div>
      <h2
        id="qf-closed-alert-title"
        className="text-xl font-black text-center mt-3"
      >
        המסעדה סגורה כרגע
      </h2>
      <p className="text-sm text-qf-ink2 text-center mt-2 leading-relaxed">
        אפשר לדפדף בתפריט, אבל לא מקבלים הזמנות חדשות כרגע. נחזור בקרוב.
      </p>
      <button
        type="button"
        onClick={onClose}
        className="mt-5 w-full px-5 py-3 rounded-2xl bg-black text-[#F8CB1E] border-2 border-black font-bold text-sm shadow-[0_3px_0_#000] hover:bg-black/90"
      >
        אישור
      </button>
    </Shell>
  );
}

function Shell({
  children,
  onClose,
  ...aria
}: {
  children: React.ReactNode;
  onClose: () => void;
} & React.AriaAttributes) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      {...aria}
      className="fixed inset-0 z-50 grid place-items-end sm:place-items-center bg-black/60 px-4 pb-4 sm:p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md bg-white rounded-3xl border-2 border-black shadow-[0_6px_0_#000] p-6 animate-qf-check-in"
      >
        {children}
      </div>
    </div>
  );
}
