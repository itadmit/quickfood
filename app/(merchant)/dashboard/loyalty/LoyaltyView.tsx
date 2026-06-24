"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/merchant/v2/PageHeader";
import { SettingsSaveBar } from "@/components/merchant/SettingsSaveBar";
import { Toggle } from "@/components/shared/Toggle";
import { ImageUploader } from "@/components/shared/ImageUploader";
import {
  IcoHeart,
  IcoSearch,
  IcoStar,
  IcoUser,
  IcoPlus,
  IcoTrash,
} from "@/components/shared/Icons";
import { LOYALTY_TIERS, type LoyaltyConfig, type LoyaltyTier } from "@/lib/loyalty/config";
import type { LoyaltyMemberRow, LoyaltyStats } from "@/lib/loyalty/members";

const TIER_STYLE: Record<LoyaltyTier, { bg: string; text: string; border: string }> = {
  silver: { bg: "#E8EAED", text: "#5B6470", border: "#C2C8D0" },
  gold: { bg: "#FBE7A1", text: "#7A5B00", border: "#E6B800" },
  platinum: { bg: "#DCE3F2", text: "#33406B", border: "#9FB0DA" },
};

function money(n: number): string {
  return `${n.toLocaleString("he-IL")} ₪`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section
      className={
        "bg-white rounded-2xl border-2 border-black shadow-[0_3px_0_#000] p-5 " + className
      }
    >
      {children}
    </section>
  );
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-bold text-qf-ink mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-xs text-qf-mute mt-1">{hint}</span>}
    </label>
  );
}

const inputCls =
  "w-full rounded-xl border-2 border-black/15 focus:border-black bg-white px-3 py-2.5 text-sm outline-none transition";

function TierBadge({ tier, config }: { tier: LoyaltyTier; config: LoyaltyConfig }) {
  const s = TIER_STYLE[tier];
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black border"
      style={{ backgroundColor: s.bg, color: s.text, borderColor: s.border }}
    >
      <IcoStar c={s.text} s={12} />
      {config.tiers[tier].name}
    </span>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-2xl border-2 border-black shadow-[0_3px_0_#000] px-4 py-3.5">
      <div className="text-2xl font-black text-qf-ink leading-none">{value}</div>
      <div className="text-xs font-semibold text-qf-mute mt-1.5">{label}</div>
    </div>
  );
}

export function LoyaltyView({
  initialConfig,
  rows,
  stats,
}: {
  initialConfig: LoyaltyConfig;
  rows: LoyaltyMemberRow[];
  stats: LoyaltyStats;
}) {
  const router = useRouter();
  const [config, setConfig] = useState<LoyaltyConfig>(initialConfig);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const [query, setQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<"all" | LoyaltyTier>("all");
  const [membersOnly, setMembersOnly] = useState(false);
  const [busyCustomer, setBusyCustomer] = useState<string | null>(null);

  function patch<K extends keyof LoyaltyConfig>(key: K, value: LoyaltyConfig[K]) {
    setConfig((c) => ({ ...c, [key]: value }));
  }
  function patchForm<K extends keyof LoyaltyConfig["joinForm"]>(
    key: K,
    value: LoyaltyConfig["joinForm"][K],
  ) {
    setConfig((c) => ({ ...c, joinForm: { ...c.joinForm, [key]: value } }));
  }
  function patchTier(tier: LoyaltyTier, field: "name" | "minPoints", value: string | number) {
    setConfig((c) => ({
      ...c,
      tiers: { ...c.tiers, [tier]: { ...c.tiers[tier], [field]: value } },
    }));
  }

  async function save() {
    setSaving(true);
    setToast(null);
    try {
      const res = await fetch("/api/v1/merchant/loyalty", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error("save failed");
      setToast({ kind: "ok", msg: "ההגדרות נשמרו" });
      router.refresh();
    } catch {
      setToast({ kind: "err", msg: "שמירה נכשלה, נסו שוב" });
    } finally {
      setSaving(false);
    }
  }

  async function toggleMember(row: LoyaltyMemberRow) {
    setBusyCustomer(row.customerId);
    try {
      await fetch(`/api/v1/merchant/loyalty/members/${row.customerId}`, {
        method: row.isMember ? "DELETE" : "POST",
      });
      router.refresh();
    } finally {
      setBusyCustomer(null);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (membersOnly && !r.isMember) return false;
      if (tierFilter !== "all" && r.tier !== tierFilter) return false;
      if (!q) return true;
      const name = `${r.firstName} ${r.lastName}`.toLowerCase();
      return name.includes(q) || r.phone.includes(q) || (r.email ?? "").toLowerCase().includes(q);
    });
  }, [rows, query, tierFilter, membersOnly]);

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        chip="חדש"
        title="מועדון לקוחות"
        subtitle="עוקבים אחרי רכישות, צוברים נקודות ומתקדמים במסלולים"
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard label="לקוחות שרכשו" value={stats.totalPurchasers} />
        <StatCard label="חברי מועדון" value={stats.totalMembers} />
        <StatCard label={config.tiers.silver.name} value={stats.byTier.silver} />
        <StatCard label={config.tiers.gold.name} value={stats.byTier.gold} />
        <StatCard label={config.tiers.platinum.name} value={stats.byTier.platinum} />
      </div>

      {/* ─── Program settings ─── */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <IcoHeart c="#000" s={20} />
          <h2 className="text-lg font-black">הגדרות המועדון</h2>
        </div>

        <div className="space-y-3">
          <label className="flex items-center justify-between gap-3 py-2 border-b border-qf-line">
            <span className="text-sm font-bold">הצג פופאפ הרשמה למועדון בכניסה לאתר</span>
            <Toggle
              checked={config.showJoinPopup}
              onChange={(v) => patch("showJoinPopup", v)}
              aria-label="הצג פופאפ הרשמה"
            />
          </label>
          {config.showJoinPopup && (
            <label className="flex items-center justify-between gap-3 py-2 border-b border-qf-line ps-4">
              <span className="text-sm text-qf-ink2">
                הצג פעם אחת בלבד לכל מבקר
                <span className="block text-xs text-qf-mute font-normal">
                  כבוי = הפופאפ יוצג בכל כניסה לאתר
                </span>
              </span>
              <Toggle
                checked={config.popupShowOnce}
                onChange={(v) => patch("popupShowOnce", v)}
                aria-label="הצג פעם אחת בלבד"
              />
            </label>
          )}
          <label className="flex items-center justify-between gap-3 py-2 border-b border-qf-line">
            <span className="text-sm font-bold">הצג צ׳קבוקס הרשמה אוטומטית בצ׳קאאוט</span>
            <Toggle
              checked={config.showCheckoutCheckbox}
              onChange={(v) => patch("showCheckoutCheckbox", v)}
              aria-label="הצג צ׳קבוקס בצ׳קאאוט"
            />
          </label>
        </div>

        <div className="mt-5 grid sm:grid-cols-2 gap-4">
          <Field label="נקודות לכל ₪1" hint="כמה נקודות הלקוח צובר על כל שקל שהוא מוציא">
            <input
              type="number"
              min={0}
              step={0.1}
              value={config.pointsPerShekel}
              onChange={(e) => patch("pointsPerShekel", Math.max(0, Number(e.target.value)))}
              className={inputCls}
            />
          </Field>
        </div>

        <h3 className="text-sm font-black mt-6 mb-2">מסלולים</h3>
        <div className="space-y-2">
          {LOYALTY_TIERS.map((t) => (
            <div
              key={t}
              className="grid grid-cols-[auto_1fr_1fr] items-center gap-3 rounded-xl border-2 border-black/10 px-3 py-2.5"
            >
              <TierBadge tier={t} config={config} />
              <input
                value={config.tiers[t].name}
                onChange={(e) => patchTier(t, "name", e.target.value)}
                className={inputCls}
                aria-label={`שם מסלול ${t}`}
              />
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={config.tiers[t].minPoints}
                  onChange={(e) => patchTier(t, "minPoints", Math.max(0, Number(e.target.value)))}
                  className={inputCls}
                  aria-label={`נקודות מינימום ${t}`}
                />
                <span className="text-xs text-qf-mute whitespace-nowrap">נק׳ ומעלה</span>
              </div>
            </div>
          ))}
        </div>

        {/* Join form builder */}
        <h3 className="text-sm font-black mt-6 mb-3">טופס ההצטרפות (פופאפ כניסה)</h3>
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="space-y-3">
            <Field label="כותרת">
              <input
                value={config.joinForm.title}
                onChange={(e) => patchForm("title", e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="תיאור">
              <textarea
                value={config.joinForm.subtitle}
                onChange={(e) => patchForm("subtitle", e.target.value)}
                rows={2}
                className={inputCls}
              />
            </Field>
            <Field label="טקסט כפתור">
              <input
                value={config.joinForm.buttonText}
                onChange={(e) => patchForm("buttonText", e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="טקסט אישור (פרטיות / תקנון / דיוור)">
              <textarea
                value={config.joinForm.consentText}
                onChange={(e) => patchForm("consentText", e.target.value)}
                rows={2}
                className={inputCls}
              />
            </Field>
            <div className="flex flex-wrap gap-4 pt-1">
              <label className="flex items-center gap-2 text-sm font-semibold">
                <Toggle
                  checked={config.joinForm.collectName}
                  onChange={(v) => patchForm("collectName", v)}
                  aria-label="אסוף שם"
                />
                שם
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <Toggle
                  checked={config.joinForm.collectEmail}
                  onChange={(v) => patchForm("collectEmail", v)}
                  aria-label="אסוף אימייל"
                />
                אימייל
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <Toggle
                  checked={config.joinForm.collectBirthday}
                  onChange={(v) => patchForm("collectBirthday", v)}
                  aria-label="אסוף יום הולדת"
                />
                יום הולדת
              </label>
            </div>

            {config.joinForm.collectBirthday && (
              <div className="rounded-xl border border-qf-line bg-qf-line-soft/40 p-3 space-y-3">
                <label className="flex items-center gap-2 text-sm font-bold">
                  <Toggle
                    checked={config.birthdayBenefit}
                    onChange={(v) => patch("birthdayBenefit", v)}
                    aria-label="הטבת יום הולדת"
                  />
                  הטבת יום הולדת
                </label>
                {config.birthdayBenefit && (
                  <>
                    <Field label="אחוז הנחה ביום הולדת">
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={config.birthdayDiscountPercent}
                        onChange={(e) =>
                          patch(
                            "birthdayDiscountPercent",
                            Math.min(100, Math.max(1, Math.round(Number(e.target.value) || 0))),
                          )
                        }
                        className={inputCls}
                      />
                    </Field>
                    <Field
                      label="ברכת יום הולדת"
                      hint="ניתן להשתמש ב: ‎{name}‎ ‎{business}‎ ‎{coupon}‎ ‎{expiry}‎"
                    >
                      <textarea
                        value={config.birthdayGreeting}
                        onChange={(e) => patch("birthdayGreeting", e.target.value)}
                        rows={7}
                        className={inputCls}
                      />
                    </Field>
                    <p className="text-xs text-qf-mute leading-relaxed">
                      ביום ההולדת נוצר קופון ייחודי לכל לקוח/ה. אם יש חבילת דיוור פעילה,
                      הברכה תישלח אוטומטית בוואטסאפ עם קוד הקופון.
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
          <div>
            <span className="block text-sm font-bold text-qf-ink mb-1.5">תמונת רקע לפופאפ</span>
            <ImageUploader
              type="campaign_image"
              value={config.joinForm.imageUrl ? [config.joinForm.imageUrl] : []}
              onChange={(urls) => patchForm("imageUrl", urls[0] ?? null)}
              multiple={false}
              max={1}
            />
          </div>
        </div>

        <div className="mt-6">
          <Field label="טקסט הצ׳קבוקס בצ׳קאאוט">
            <textarea
              value={config.checkoutConsentText}
              onChange={(e) => patch("checkoutConsentText", e.target.value)}
              rows={2}
              className={inputCls}
            />
          </Field>
        </div>

        <div className="mt-5">
          <SettingsSaveBar saving={saving} onSave={save} toast={toast} />
        </div>
      </Card>

      {/* ─── Members / customers table ─── */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <IcoUser c="#000" s={20} />
            <h2 className="text-lg font-black">לקוחות וחברי מועדון</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <span className="absolute inset-s-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                <IcoSearch c="#9aa0a6" s={16} />
              </span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="חיפוש שם / טלפון / אימייל"
                className="rounded-xl border-2 border-black/15 focus:border-black bg-white ps-8 pe-3 py-2 text-sm outline-none w-56"
              />
            </div>
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value as "all" | LoyaltyTier)}
              className="rounded-xl border-2 border-black/15 focus:border-black bg-white px-3 py-2 text-sm outline-none font-semibold"
            >
              <option value="all">כל המסלולים</option>
              {LOYALTY_TIERS.map((t) => (
                <option key={t} value={t}>
                  {config.tiers[t].name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setMembersOnly((v) => !v)}
              className={
                "px-3 py-2 rounded-xl border-2 text-sm font-bold transition " +
                (membersOnly
                  ? "bg-[#F8CB1E] border-black shadow-[0_2px_0_#000]"
                  : "bg-white border-black/15 hover:border-black")
              }
            >
              חברי מועדון בלבד
            </button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center text-sm text-qf-mute py-10">
            עדיין אין לקוחות להצגה. ברגע שלקוחות יזמינו או יצטרפו למועדון הם יופיעו כאן.
          </div>
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="text-qf-mute text-xs border-b-2 border-black/10">
                  <th className="text-start font-bold px-2 py-2">לקוח</th>
                  <th className="text-start font-bold px-2 py-2">מסלול</th>
                  <th className="text-start font-bold px-2 py-2">נקודות</th>
                  <th className="text-start font-bold px-2 py-2">סה״כ רכישות</th>
                  <th className="text-start font-bold px-2 py-2">הזמנות</th>
                  <th className="text-start font-bold px-2 py-2">סטטוס</th>
                  <th className="text-start font-bold px-2 py-2">הצטרפות</th>
                  <th className="text-end font-bold px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.customerId} className="border-b border-qf-line last:border-0">
                    <td className="px-2 py-2.5">
                      <div className="font-bold text-qf-ink">
                        {`${r.firstName} ${r.lastName}`.trim() || "לקוח"}
                      </div>
                      <div className="text-xs text-qf-mute" dir="ltr">
                        {r.phone}
                      </div>
                    </td>
                    <td className="px-2 py-2.5">
                      <TierBadge tier={r.tier} config={config} />
                    </td>
                    <td className="px-2 py-2.5 font-black">{r.points.toLocaleString("he-IL")}</td>
                    <td className="px-2 py-2.5 font-bold">{money(r.spent)}</td>
                    <td className="px-2 py-2.5">{r.orderCount}</td>
                    <td className="px-2 py-2.5">
                      {r.isMember ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F8CB1E] border-2 border-black text-xs font-black">
                          <IcoHeart c="#000" s={11} /> חבר מועדון
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-qf-green-soft text-qf-green-deep text-xs font-bold">
                          רכש
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-xs text-qf-mute">{formatDate(r.joinedAt)}</td>
                    <td className="px-2 py-2.5 text-end">
                      <button
                        type="button"
                        disabled={busyCustomer === r.customerId}
                        onClick={() => toggleMember(r)}
                        className={
                          "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border-2 text-xs font-bold transition disabled:opacity-50 " +
                          (r.isMember
                            ? "border-qf-tomato/30 text-qf-tomato hover:bg-qf-tomato-soft"
                            : "border-black/15 hover:border-black")
                        }
                      >
                        {r.isMember ? (
                          <>
                            <IcoTrash c="currentColor" s={12} /> הסר
                          </>
                        ) : (
                          <>
                            <IcoPlus c="currentColor" s={12} /> צרף
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ─── Mailing moved to the unified דיוור hub ─── */}
      <Card>
        <div className="flex items-center gap-2 mb-1">
          <IcoHeart c="#000" s={20} />
          <h2 className="text-lg font-black">דיוור לחברי המועדון</h2>
        </div>
        <p className="text-sm text-qf-mute mb-3">
          שליחת מבצעים והטבות לחברי המועדון עברה למסך הדיוור המאוחד, יחד עם יתרת ההודעות, רכישת חבילות והתראות הלקוח.
        </p>
        <Link
          href="/dashboard/messaging"
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#F8CB1E] hover:bg-[#FFD843] text-black border-2 border-black shadow-[0_2px_0_#000] active:translate-y-px active:shadow-[0_1px_0_#000] text-sm font-black transition-all"
        >
          למסך הדיוור
        </Link>
      </Card>
    </div>
  );
}
