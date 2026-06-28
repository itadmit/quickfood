"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/merchant/v2/PageHeader";
import { IcoArrowRight, IcoChevDown } from "@/components/shared/Icons";

interface SourceRow {
  sourceKey: string;
  sourceLabel: string;
  sourceCategory: string;
  isActive: boolean;
  sortOrder: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  marketplace: "אפליקציית משלוחים",
  social: "רשת חברתית",
  search: "חיפוש",
  referral: "המלצה",
  walk_in: "מזדמן",
  qr: "QR",
  other: "אחר",
};

export function SourcesView({
  initialSources,
  commissionRate,
}: {
  initialSources: SourceRow[];
  commissionRate: number;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<SourceRow[]>(initialSources);
  const [rate, setRate] = useState(commissionRate);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function update(key: string, patch: Partial<SourceRow>) {
    setRows((r) => r.map((s) => (s.sourceKey === key ? { ...s, ...patch } : s)));
    setSaved(false);
  }

  function move(idx: number, dir: -1 | 1) {
    const next = [...rows];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    setRows(next.map((s, i) => ({ ...s, sortOrder: i })));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    await Promise.all([
      fetch("/api/v1/merchant/growth/sources", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sources: rows.map((s, i) => ({
            sourceKey: s.sourceKey,
            sourceLabel: s.sourceLabel,
            isActive: s.isActive,
            sortOrder: i,
          })),
        }),
      }),
      fetch("/api/v1/merchant/growth/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commissionRate: rate }),
      }),
    ]).catch(() => {});
    setSaving(false);
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="space-y-5 pb-16">
      <PageHeader
        chip="GROWTH"
        title="מקורות לקוחות"
        subtitle="מה לשאול לקוחות חדשים ב„איך הגעת אלינו”"
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

      <section className="rounded-3xl border-2 border-black bg-white shadow-[0_3px_0_#000] p-5">
        <h2 className="font-black text-lg text-qf-ink mb-1">אפשרויות השאלה</h2>
        <p className="text-sm text-qf-ink2 mb-4">
          כבו מקורות שלא רלוונטיים, שנו ניסוח, או סדרו מחדש. רק מקורות פעילים מוצגים ללקוח בקופה.
        </p>
        <div className="space-y-2">
          {rows.map((s, idx) => (
            <div key={s.sourceKey} className="flex items-center gap-3 rounded-2xl border border-qf-line p-3">
              <div className="flex flex-col gap-0.5 shrink-0">
                <button
                  onClick={() => move(idx, -1)}
                  disabled={idx === 0}
                  className="w-6 h-5 grid place-items-center rounded border border-qf-line disabled:opacity-30 rotate-180"
                  aria-label="העלה"
                >
                  <IcoChevDown s={12} />
                </button>
                <button
                  onClick={() => move(idx, 1)}
                  disabled={idx === rows.length - 1}
                  className="w-6 h-5 grid place-items-center rounded border border-qf-line disabled:opacity-30"
                  aria-label="הורד"
                >
                  <IcoChevDown s={12} />
                </button>
              </div>
              <input
                value={s.sourceLabel}
                onChange={(e) => update(s.sourceKey, { sourceLabel: e.target.value })}
                className="flex-1 min-w-0 bg-qf-bg border border-qf-line rounded-xl px-3 py-2 text-sm outline-none focus:border-(--qf-primary) focus:bg-white"
              />
              <span className="text-[11px] text-qf-ink2 shrink-0 w-24 text-center">
                {CATEGORY_LABELS[s.sourceCategory] ?? s.sourceCategory}
              </span>
              <button
                onClick={() => update(s.sourceKey, { isActive: !s.isActive })}
                className={`shrink-0 text-xs font-bold rounded-lg px-3 py-1.5 border transition ${
                  s.isActive
                    ? "bg-qf-green-soft text-qf-green-deep border-qf-green"
                    : "bg-white text-qf-ink2 border-qf-line"
                }`}
              >
                {s.isActive ? "פעיל" : "כבוי"}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border-2 border-black bg-white shadow-[0_3px_0_#000] p-5">
        <h2 className="font-black text-lg text-qf-ink mb-1">עמלת שוק להערכת חיסכון</h2>
        <p className="text-sm text-qf-ink2 mb-4">
          לפי אחוז זה אנחנו מחשבים את החיסכון <strong>המשוער</strong> בעמלות כשלקוחות שהגיעו מאפליקציות
          מזמינים ישירות ממך. זו הערכה בלבד, לא מספר מדויק.
        </p>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={0}
            max={100}
            value={rate}
            onChange={(e) => {
              setRate(Number(e.target.value));
              setSaved(false);
            }}
            className="w-24 bg-qf-bg border border-qf-line rounded-xl px-3 py-2 text-base outline-none focus:border-(--qf-primary) focus:bg-white tnum"
          />
          <span className="text-lg font-bold text-qf-ink">%</span>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="bg-black text-white font-bold rounded-2xl px-6 py-3 text-sm disabled:opacity-60"
        >
          {saving ? "שומר..." : "שמירה"}
        </button>
        {saved && <span className="text-sm text-qf-green-deep font-semibold">נשמר</span>}
      </div>
    </div>
  );
}
