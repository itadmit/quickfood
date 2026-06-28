"use client";

import Link from "next/link";
import { PageHeader } from "@/components/merchant/v2/PageHeader";
import { IcoArrowRight } from "@/components/shared/Icons";
import { formatPrice } from "@/lib/format";
import type { CustomerSegments, RepeatCustomerRow } from "@/lib/growth/customers";

const RISK_STYLE: Record<RepeatCustomerRow["risk"], { label: string; cls: string }> = {
  active: { label: "פעיל", cls: "bg-qf-green-soft text-qf-green-deep" },
  cooling: { label: "מתקרר", cls: "bg-qf-blue-soft text-qf-blue" },
  at_risk: { label: "בסיכון", cls: "bg-amber-100 text-amber-700" },
  lost: { label: "אבוד", cls: "bg-qf-tomato-soft text-qf-tomato" },
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export function RepeatCustomersView({
  segments,
  rows,
}: {
  segments: CustomerSegments;
  rows: RepeatCustomerRow[];
}) {
  const winBack = rows.filter((r) => r.risk === "at_risk" || r.risk === "lost");

  return (
    <div className="space-y-5 pb-16">
      <PageHeader
        chip="GROWTH"
        title="לקוחות חוזרים"
        subtitle="מי חוזר להזמין, ומי צריך תזכורת קטנה כדי לחזור"
        actions={
          <Link
            href="/dashboard/growth"
            className="inline-flex items-center gap-2 bg-black text-white font-bold rounded-2xl px-4 py-2.5 text-sm hover:bg-black/80 transition"
          >
            <IcoArrowRight s={18} />
            חזרה ל-Growth
          </Link>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <Seg label="לקוחות ישירים" value={segments.directCustomers} />
        <Seg label="הזמינו פעם אחת" value={segments.singleOrder} />
        <Seg label="חוזרים (2+)" value={segments.repeat} highlight />
        <Seg label="לא הזמינו 30 יום" value={segments.inactive30} />
        <Seg label="לא הזמינו 60 יום" value={segments.inactive60} />
        <Seg label="חברי מועדון" value={segments.vip} />
      </div>

      {winBack.length > 0 && (
        <div className="rounded-3xl border-2 border-black bg-[#F8CB1E] shadow-[0_3px_0_#000] p-5">
          <div className="font-black text-lg text-qf-ink">
            {winBack.length} לקוחות חוזרים בסיכון לנטוש
          </div>
          <p className="text-sm text-black/70 mt-1">
            לקוחות שהזמינו אצלך כמה פעמים ולא חזרו זמן מה. תזכורת עם הטבה קטנה מחזירה אותם בעלות נמוכה.
          </p>
          <Link
            href="/dashboard/messaging"
            className="mt-3 inline-flex items-center gap-2 bg-black text-white font-bold rounded-2xl px-4 py-2.5 text-sm"
          >
            שלחו קמפיין החזרה
          </Link>
        </div>
      )}

      <section className="rounded-3xl border-2 border-black bg-white shadow-[0_3px_0_#000] p-5">
        <h2 className="font-black text-lg text-qf-ink mb-3">לקוחות חוזרים (החזרה דחופה למעלה)</h2>
        {rows.length === 0 ? (
          <div className="text-sm text-qf-ink2 bg-qf-bg rounded-2xl px-4 py-5 text-center">
            עדיין אין לקוחות שהזמינו ישירות יותר מפעם אחת. ברגע שיתחילו לחזור — תראו אותם כאן.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-qf-ink2 text-xs border-b border-qf-line">
                  <th className="text-right font-semibold py-2">לקוח/ה</th>
                  <th className="text-right font-semibold py-2">הזמנות</th>
                  <th className="text-right font-semibold py-2">סה״כ</th>
                  <th className="text-right font-semibold py-2">הזמנה אחרונה</th>
                  <th className="text-right font-semibold py-2">מקור</th>
                  <th className="text-right font-semibold py-2">סטטוס</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.customerId} className="border-b border-qf-line-soft">
                    <td className="py-2.5">
                      <div className="font-semibold text-qf-ink">{r.name}</div>
                      <div className="text-[11px] text-qf-ink2">{r.phone}</div>
                    </td>
                    <td className="py-2.5 tnum">{r.orderCount}</td>
                    <td className="py-2.5 tnum">{formatPrice(r.totalSpent)}</td>
                    <td className="py-2.5">
                      <span className="tnum">{fmtDate(r.lastOrderAt)}</span>
                      <span className="text-[11px] text-qf-ink2"> · לפני {r.daysSinceOrder} ימים</span>
                    </td>
                    <td className="py-2.5 text-qf-ink2">{r.sourceLabel ?? "לא ידוע"}</td>
                    <td className="py-2.5">
                      <span className={`text-[11px] font-semibold rounded-md px-2 py-0.5 ${RISK_STYLE[r.risk].cls}`}>
                        {RISK_STYLE[r.risk].label}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Seg({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div
      className={`rounded-2xl border-2 border-black p-3 shadow-[0_3px_0_#000] ${
        highlight ? "bg-[#F8CB1E]" : "bg-white"
      }`}
    >
      <div className="text-2xl font-black text-qf-ink tnum">{value}</div>
      <div className={`text-[11px] mt-0.5 ${highlight ? "text-black/60" : "text-qf-ink2"}`}>{label}</div>
    </div>
  );
}
