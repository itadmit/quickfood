"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/merchant/v2/PageHeader";
import { Modal, ModalHeader, ModalBody } from "@/components/shared/Modal";
import { IcoArrowRight } from "@/components/shared/Icons";
import { formatPrice } from "@/lib/format";
import type { CustomerSegments, CustomerRow, SentCampaignRow, ChurnRisk } from "@/lib/growth/customers";
import { SendCampaignModal } from "../SendCampaignModal";

const RISK_STYLE: Record<ChurnRisk, { label: string; cls: string }> = {
  active: { label: "פעיל", cls: "bg-qf-green-soft text-qf-green-deep" },
  cooling: { label: "מתקרר", cls: "bg-qf-blue-soft text-qf-blue" },
  at_risk: { label: "בסיכון", cls: "bg-amber-100 text-amber-700" },
  lost: { label: "אבוד", cls: "bg-qf-tomato-soft text-qf-tomato" },
};

type SegKey = "all" | "repeat" | "single" | "inactive30" | "inactive60" | "vip";

const SEGMENT_TO_CAMPAIGN: Record<string, string> = {
  inactive30: "inactive_30d",
  inactive60: "inactive_60d",
  repeat: "repeat",
  all: "all_direct",
};

const CHANNEL_LABELS: Record<string, string> = { email: "אימייל", sms: "SMS", whatsapp: "וואטסאפ" };
const CAMPAIGN_SEGMENT_LABELS: Record<string, string> = {
  inactive_30d: "לא הזמינו 30 יום",
  inactive_60d: "לא הזמינו 60 יום",
  repeat: "לקוחות חוזרים",
  birthday_today: "ימי הולדת",
  all_direct: "כל הלקוחות הישירים",
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function matchesSegment(r: CustomerRow, seg: SegKey): boolean {
  switch (seg) {
    case "repeat":
      return r.orderCount > 1;
    case "single":
      return r.orderCount === 1;
    case "inactive30":
      return r.daysSinceOrder >= 30;
    case "inactive60":
      return r.daysSinceOrder >= 60;
    case "vip":
      return r.isMember;
    default:
      return true;
  }
}

export function RepeatCustomersView({
  segments,
  rows,
  campaigns,
}: {
  segments: CustomerSegments;
  rows: CustomerRow[];
  campaigns: SentCampaignRow[];
}) {
  const [seg, setSeg] = useState<SegKey>("repeat");
  const [profile, setProfile] = useState<CustomerRow | null>(null);
  const [campaignSegment, setCampaignSegment] = useState<string | null>(null);

  const filtered = rows.filter((r) => matchesSegment(r, seg));
  const canCampaign = SEGMENT_TO_CAMPAIGN[seg];

  const cards: { key: SegKey; label: string; value: number }[] = [
    { key: "all", label: "לקוחות ישירים", value: segments.directCustomers },
    { key: "single", label: "הזמינו פעם אחת", value: segments.singleOrder },
    { key: "repeat", label: "חוזרים (2+)", value: segments.repeat },
    { key: "inactive30", label: "לא הזמינו 30 יום", value: segments.inactive30 },
    { key: "inactive60", label: "לא הזמינו 60 יום", value: segments.inactive60 },
    { key: "vip", label: "חברי מועדון", value: segments.vip },
  ];

  return (
    <div className="space-y-5 pb-16">
      <PageHeader
        chip="BOOST"
        title="לקוחות"
        subtitle="לחצו על סגמנט כדי לסנן, על לקוח כדי לראות פרופיל"
        actions={
          <Link
            href="/dashboard/growth"
            className="inline-flex items-center gap-2 bg-black text-white font-bold rounded-2xl px-4 py-2.5 text-sm hover:bg-black/80 transition"
          >
            <IcoArrowRight s={18} />
            חזרה ל-Boost
          </Link>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {cards.map((c) => (
          <button
            key={c.key}
            onClick={() => setSeg(c.key)}
            className={`text-right rounded-2xl border-2 border-black p-3 shadow-[0_3px_0_#000] transition ${
              seg === c.key ? "bg-[#F8CB1E]" : "bg-white hover:bg-qf-bg"
            }`}
          >
            <div className="text-2xl font-black text-qf-ink tnum">{c.value}</div>
            <div className={`text-[11px] mt-0.5 ${seg === c.key ? "text-black/60" : "text-qf-ink2"}`}>{c.label}</div>
          </button>
        ))}
      </div>

      <section className="rounded-3xl border-2 border-black bg-white shadow-[0_3px_0_#000] p-5">
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <h2 className="font-black text-lg text-qf-ink">
            {cards.find((c) => c.key === seg)?.label} ({filtered.length})
          </h2>
          {canCampaign && filtered.length > 0 && (
            <button
              onClick={() => setCampaignSegment(SEGMENT_TO_CAMPAIGN[seg])}
              className="bg-black text-white text-xs font-bold rounded-xl px-3 py-2"
            >
              שליחת קמפיין לסגמנט
            </button>
          )}
        </div>
        {filtered.length === 0 ? (
          <div className="text-sm text-qf-ink2 bg-qf-bg rounded-2xl px-4 py-5 text-center">
            אין לקוחות בסגמנט הזה כרגע.
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
                {filtered.map((r) => (
                  <tr
                    key={r.customerId}
                    onClick={() => setProfile(r)}
                    className="border-b border-qf-line-soft cursor-pointer hover:bg-qf-bg"
                  >
                    <td className="py-2.5">
                      <div className="font-semibold text-qf-ink">{r.name}</div>
                      <div className="text-[11px] text-qf-ink2">{r.phone}</div>
                    </td>
                    <td className="py-2.5 tnum">{r.orderCount}</td>
                    <td className="py-2.5 tnum">{formatPrice(r.totalSpent)}</td>
                    <td className="py-2.5">
                      <span className="tnum">{fmtDate(r.lastOrderAt)}</span>
                      <span className="text-[11px] text-qf-ink2"> · {r.daysSinceOrder} ימים</span>
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

      {/* ─── Campaign history ─── */}
      {campaigns.length > 0 && (
        <section className="rounded-3xl border-2 border-black bg-white shadow-[0_3px_0_#000] p-5">
          <h2 className="font-black text-lg text-qf-ink mb-3">קמפיינים שנשלחו</h2>
          <div className="space-y-2">
            {campaigns.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 rounded-2xl border border-qf-line p-3 flex-wrap">
                <div className="min-w-0">
                  <div className="font-semibold text-sm text-qf-ink">
                    {CAMPAIGN_SEGMENT_LABELS[c.segment] ?? c.segment} · {CHANNEL_LABELS[c.channel] ?? c.channel}
                  </div>
                  <div className="text-[11px] text-qf-ink2">{fmtDate(c.createdAt)}</div>
                </div>
                <div className="text-sm text-qf-ink2">
                  נשלח ל-<strong className="text-qf-ink">{c.sent}</strong> מתוך {c.recipients}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {profile && <ProfileModal r={profile} onClose={() => setProfile(null)} />}
      {campaignSegment && (
        <SendCampaignModal segment={campaignSegment} onClose={() => setCampaignSegment(null)} />
      )}
    </div>
  );
}

function ProfileModal({ r, onClose }: { r: CustomerRow; onClose: () => void }) {
  const rows: { label: string; value: string }[] = [
    { label: "טלפון", value: r.phone || "—" },
    { label: "אימייל", value: r.email || "—" },
    { label: "מקור ראשון", value: r.sourceLabel ?? "לא ידוע" },
    { label: "קמפיין ראשון", value: r.firstCampaign ?? "—" },
    { label: "הזמנה ראשונה", value: fmtDate(r.firstOrderAt) },
    { label: "הזמנה אחרונה", value: `${fmtDate(r.lastOrderAt)} · לפני ${r.daysSinceOrder} ימים` },
    { label: "מספר הזמנות ישירות", value: String(r.orderCount) },
    { label: "סה״כ הכנסה ישירה", value: formatPrice(r.totalSpent) },
    { label: "עמלה חסוכה (משוער)", value: r.estCommissionSaved > 0 ? formatPrice(r.estCommissionSaved) : "—" },
    { label: "חבר/ת מועדון", value: r.isMember ? "כן" : "לא" },
    { label: "סטטוס", value: RISK_STYLE[r.risk].label },
  ];
  return (
    <Modal open onClose={onClose} size="md" ariaLabel={r.name}>
      <ModalHeader title={r.name} subtitle="פרופיל לקוח" onClose={onClose} />
      <ModalBody>
        <dl className="divide-y divide-qf-line-soft">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-3 py-2.5">
              <dt className="text-sm text-qf-ink2">{row.label}</dt>
              <dd className="text-sm font-semibold text-qf-ink text-left">{row.value}</dd>
            </div>
          ))}
        </dl>
      </ModalBody>
    </Modal>
  );
}
