"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/merchant/v2/PageHeader";
import {
  IcoTrend,
  IcoQrCode,
  IcoSparkle,
  IcoCheck,
  IcoClose,
  IcoArrowLeft,
  IcoCopy,
} from "@/components/shared/Icons";
import { formatPrice } from "@/lib/format";
import type { GrowthOverview, FunnelStage, SourceBreakdownRow, QrPerformanceRow } from "@/lib/growth/analytics";
import type { GrowthScoreResult } from "@/lib/growth/score";
import type { GrowthInsight } from "@/lib/growth/insights";
import type { DailyBriefing } from "@/lib/growth/briefing";
import { CreateQrModal } from "./CreateQrModal";
import { SendCampaignModal } from "./SendCampaignModal";

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  expectedImpact: string | null;
  actionType: string | null;
  actionPayload: Record<string, unknown> | null;
}

// Where each one-click action sends the merchant (reuses existing tools).
function actionHref(actionType: string | null | undefined): string | null {
  switch (actionType) {
    case "create_coupon":
      return "/dashboard/coupons";
    case "edit_loyalty":
      return "/dashboard/loyalty";
    case "external_link":
      return null;
    default:
      return null;
  }
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-3xl border-2 border-black bg-white shadow-[0_3px_0_#000] ${className}`}>
      {children}
    </section>
  );
}

function SectionTitle({ icon, children, hint }: { icon?: React.ReactNode; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      {icon}
      <h2 className="font-black text-lg text-qf-ink">{children}</h2>
      {hint && <span className="text-xs text-qf-ink2 font-medium">{hint}</span>}
    </div>
  );
}

export function GrowthView({
  slug,
  businessName,
  overview,
  funnel,
  sources,
  qr,
  score,
  insights,
  briefing,
  tasks,
}: {
  slug: string;
  businessName: string;
  overview: GrowthOverview;
  funnel: FunnelStage[];
  sources: SourceBreakdownRow[];
  qr: QrPerformanceRow[];
  score: GrowthScoreResult;
  insights: GrowthInsight[];
  briefing: DailyBriefing;
  tasks: TaskRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [campaignSegment, setCampaignSegment] = useState<string | null>(null);

  function post(url: string, body: unknown) {
    startTransition(async () => {
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).catch(() => {});
      router.refresh();
    });
  }

  // One-click action router shared by tasks, briefing findings and insights.
  function runAction(actionType: string | null | undefined, payload?: Record<string, unknown> | null) {
    if (actionType === "create_qr") {
      setQrModalOpen(true);
      return;
    }
    if (actionType === "send_campaign") {
      const seg = typeof payload?.segment === "string" ? payload.segment : "inactive_30d";
      setCampaignSegment(seg);
      return;
    }
    const href = actionHref(actionType);
    if (href) router.push(href);
  }

  return (
    <div className="space-y-5 pb-16">
      <PageHeader
        chip="GROWTH"
        title="מנוע הצמיחה שלך"
        subtitle="מה כדאי לעשות היום כדי להביא יותר לקוחות ישירים"
        actions={
          <button
            onClick={() => setQrModalOpen(true)}
            className="inline-flex items-center gap-2 bg-black text-white font-bold rounded-2xl px-4 py-2.5 text-sm hover:bg-black/80 transition"
          >
            <IcoQrCode s={18} />
            צרו קמפיין QR
          </button>
        }
      />

      {/* ─── Sub-nav to the Growth sections ─── */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/dashboard/growth/customers"
          className="text-sm font-semibold rounded-2xl border-2 border-black bg-white px-4 py-2 hover:bg-qf-bg transition"
        >
          לקוחות חוזרים
        </Link>
        <Link
          href="/dashboard/growth/sources"
          className="text-sm font-semibold rounded-2xl border-2 border-black bg-white px-4 py-2 hover:bg-qf-bg transition"
        >
          מקורות לקוחות
        </Link>
      </div>

      {/* ─── Daily AI Briefing - the 30-second morning read ─── */}
      <Card className="p-5 bg-gradient-to-l from-[#FFF8E1] to-white">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-10 h-10 rounded-2xl bg-black grid place-items-center text-[#F8CB1E]">
            <IcoSparkle s={20} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-black text-lg text-qf-ink">{briefing.greeting}. הנה מה שמצאתי היום:</div>
            <ul className="mt-2 space-y-2">
              {briefing.findings.map((f, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2 text-sm text-qf-ink">
                  <span className="w-1.5 h-1.5 rounded-full bg-black/40 shrink-0" />
                  <span>{f.text}</span>
                  {f.actionLabel && (
                    <button
                      onClick={() => runAction(f.actionType, f.actionPayload)}
                      className="text-xs font-bold text-black underline underline-offset-2"
                    >
                      {f.actionLabel}
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {briefing.estimatedOpportunity > 0 && (
              <div className="mt-3 inline-flex items-center gap-2 bg-black/5 rounded-xl px-3 py-1.5 text-sm">
                <span className="text-qf-ink2">הזדמנות משוערת היום:</span>
                <span className="font-black text-qf-ink">{formatPrice(briefing.estimatedOpportunity)}</span>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* ─── Growth Score + Checklist ─── */}
      <div className="grid lg:grid-cols-[280px_1fr] gap-5">
        <Card className="p-5 flex flex-col items-center justify-center text-center">
          <div className="text-xs font-bold text-qf-ink2 mb-1">GROWTH SCORE</div>
          <ScoreRing score={score.score} />
          <div className="mt-2 text-sm text-qf-ink2">
            {score.completed} מתוך {score.total} צעדים הושלמו
          </div>
        </Card>
        <Card className="p-5">
          <SectionTitle icon={<IcoCheck s={18} />} hint="כל צעד שמושלם מעלה את הציון">
            צ׳קליסט הצמיחה
          </SectionTitle>
          <div className="space-y-2">
            {score.checklist.map((item) => (
              <div
                key={item.key}
                className="flex items-start gap-3 rounded-2xl border border-qf-line p-3"
              >
                <button
                  disabled={item.auto || pending}
                  onClick={() =>
                    post("/api/v1/merchant/growth/checklist", {
                      key: item.key,
                      title: item.title,
                      done: !item.done,
                    })
                  }
                  className={`mt-0.5 w-6 h-6 rounded-lg border-2 grid place-items-center shrink-0 transition ${
                    item.done
                      ? "bg-qf-green border-qf-green text-white"
                      : "border-qf-line bg-white"
                  } ${item.auto ? "opacity-80 cursor-default" : "cursor-pointer"}`}
                  aria-label={item.done ? "הושלם" : "סמן כהושלם"}
                >
                  {item.done && <IcoCheck s={14} c="#fff" />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className={`font-semibold text-sm ${item.done ? "text-qf-ink2 line-through" : "text-qf-ink"}`}>
                    {item.title}
                  </div>
                  <div className="text-xs text-qf-ink2 mt-0.5">{item.description}</div>
                </div>
                {!item.done && (
                  <button
                    onClick={() => {
                      if (item.actionType === "create_qr") setQrModalOpen(true);
                      else {
                        const href = actionHref(item.actionType);
                        if (href) router.push(href);
                      }
                    }}
                    className="shrink-0 text-xs font-bold text-black inline-flex items-center gap-1"
                  >
                    בצע <IcoArrowLeft s={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ─── Action queue: Growth Tasks ─── */}
      {tasks.length > 0 && (
        <Card className="p-5">
          <SectionTitle icon={<IcoTrend s={18} />} hint="מה כדאי לעשות עכשיו">
            משימות צמיחה
          </SectionTitle>
          <div className="space-y-2.5">
            {tasks.map((t) => (
              <div key={t.id} className="rounded-2xl border border-qf-line p-3.5 flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-sm text-qf-ink">{t.title}</div>
                  {t.description && <div className="text-xs text-qf-ink2 mt-1">{t.description}</div>}
                  {t.expectedImpact && (
                    <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-qf-green-deep bg-qf-green-soft rounded-md px-2 py-0.5">
                      {t.expectedImpact}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  <button
                    onClick={() => runAction(t.actionType, t.actionPayload)}
                    className="bg-black text-white text-xs font-bold rounded-xl px-3 py-1.5 hover:bg-black/80 transition"
                  >
                    בצע
                  </button>
                  <div className="flex gap-1.5">
                    <button
                      title="סיימתי"
                      onClick={() => post(`/api/v1/merchant/growth/tasks/${t.id}`, { status: "completed" })}
                      className="w-7 h-7 grid place-items-center rounded-lg border border-qf-line text-qf-green-deep"
                    >
                      <IcoCheck s={14} />
                    </button>
                    <button
                      title="התעלם"
                      onClick={() => post(`/api/v1/merchant/growth/tasks/${t.id}`, { status: "dismissed" })}
                      className="w-7 h-7 grid place-items-center rounded-lg border border-qf-line text-qf-ink2"
                    >
                      <IcoClose s={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ─── Headline metrics - commission saved leads ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <BigMetric
          label="עמלות שחסכת (משוער)"
          value={formatPrice(overview.estimatedCommissionSaved)}
          sub={`לפי ${overview.commissionRate}% עמלת שוק`}
          highlight
        />
        <BigMetric label="לקוחות ישירים החודש" value={String(overview.directCustomersAcquired)} />
        <BigMetric label="הזמנות חוזרות ישירות" value={String(overview.repeatDirectOrders)} />
        <BigMetric label="הכנסה ישירה החודש" value={formatPrice(overview.directRevenue)} />
      </div>

      {/* ─── AI Insights ─── */}
      {insights.length > 0 && (
        <Card className="p-5">
          <SectionTitle icon={<IcoSparkle s={18} />} hint="המלצות מנהל הצמיחה">
            תובנות חכמות
          </SectionTitle>
          <div className="grid md:grid-cols-2 gap-3">
            {insights.map((ins) => (
              <div key={ins.id} className="rounded-2xl border border-qf-line p-4">
                <div className="font-bold text-sm text-qf-ink">{ins.title}</div>
                <div className="text-xs text-qf-ink2 mt-1.5 leading-relaxed">{ins.body}</div>
                {ins.expectedImpact && (
                  <div className="mt-2 inline-block text-[11px] font-semibold text-qf-green-deep bg-qf-green-soft rounded-md px-2 py-0.5">
                    {ins.expectedImpact}
                  </div>
                )}
                {ins.actionLabel && (
                  <button
                    onClick={() => runAction(ins.actionType, ins.actionPayload)}
                    className="mt-3 block text-xs font-bold text-black inline-flex items-center gap-1"
                  >
                    {ins.actionLabel} <IcoArrowLeft s={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ─── Growth Timeline / funnel ─── */}
      <Card className="p-5">
        <SectionTitle hint="התקדמות החודש">המסע של הלקוח</SectionTitle>
        <div className="flex flex-wrap items-center gap-2">
          {funnel.map((stage, i) => (
            <div key={stage.key} className="flex items-center gap-2">
              <div className="rounded-2xl border border-qf-line px-4 py-3 text-center min-w-[110px]">
                <div className="text-2xl font-black text-qf-ink tnum">{stage.count}</div>
                <div className="text-[11px] text-qf-ink2 mt-0.5">{stage.label}</div>
              </div>
              {i < funnel.length - 1 && <IcoArrowLeft s={16} c="#9ca3af" />}
            </div>
          ))}
        </div>
      </Card>

      {/* ─── Source breakdown ─── */}
      <Card className="p-5">
        <SectionTitle hint="כולל לקוחות שמקורם לא ידוע">מאיפה הלקוחות הגיעו</SectionTitle>
        {sources.length === 0 ? (
          <EmptyHint>עדיין אין מספיק נתונים. ברגע שלקוחות יזמינו ויענו על „איך הגעת אלינו” — תראו כאן פירוט.</EmptyHint>
        ) : (
          <div className="space-y-2">
            {sources.map((s) => (
              <div key={s.source} className="flex items-center gap-3 rounded-2xl border border-qf-line p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-qf-ink">{s.label}</span>
                    {s.category === "unknown" && (
                      <span className="text-[10px] bg-qf-mute/30 text-qf-ink2 rounded px-1.5 py-0.5">לא ידוע</span>
                    )}
                    {s.selfReported && s.category !== "unknown" && (
                      <span className="text-[10px] bg-qf-blue-soft text-qf-blue rounded px-1.5 py-0.5">דיווח עצמי</span>
                    )}
                  </div>
                  <div className="text-xs text-qf-ink2 mt-0.5">
                    {s.customers} לקוחות · הזמנה ממוצעת {formatPrice(s.avgOrderValue)}
                  </div>
                </div>
                <div className="text-left shrink-0">
                  <div className="font-bold text-sm text-qf-ink tnum">{formatPrice(s.revenue)}</div>
                  {s.estimatedCommissionSaved > 0 && (
                    <div className="text-[11px] text-qf-green-deep">חיסכון ~{formatPrice(s.estimatedCommissionSaved)}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ─── QR campaigns ─── */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <SectionTitle icon={<IcoQrCode s={18} />}>קמפיינים QR</SectionTitle>
          <button
            onClick={() => setQrModalOpen(true)}
            className="text-xs font-bold text-black inline-flex items-center gap-1"
          >
            קמפיין חדש <IcoArrowLeft s={12} />
          </button>
        </div>
        {qr.length === 0 ? (
          <EmptyHint>
            צרו קוד QR ראשון, הדביקו אותו על שקיות המשלוח — וכל לקוח של אפליקציות המשלוחים יכול להפוך ללקוח ישיר שלכם.
          </EmptyHint>
        ) : (
          <div className="space-y-2">
            {qr.map((c) => (
              <QrRow key={c.campaignId} c={c} slug={slug} />
            ))}
          </div>
        )}
      </Card>

      {qrModalOpen && (
        <CreateQrModal
          businessName={businessName}
          onClose={() => setQrModalOpen(false)}
          onCreated={() => {
            setQrModalOpen(false);
            router.refresh();
          }}
        />
      )}

      {campaignSegment && (
        <SendCampaignModal segment={campaignSegment} onClose={() => setCampaignSegment(null)} />
      )}
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 75 ? "#16a34a" : score >= 45 ? "#F8CB1E" : "#ef4444";
  return (
    <div
      className="w-32 h-32 rounded-full grid place-items-center"
      style={{ background: `conic-gradient(${color} ${score * 3.6}deg, #eee 0deg)` }}
    >
      <div className="w-24 h-24 rounded-full bg-white grid place-items-center">
        <div className="text-center">
          <div className="text-3xl font-black text-qf-ink leading-none tnum">{score}</div>
          <div className="text-[10px] text-qf-ink2 mt-0.5">מתוך 100</div>
        </div>
      </div>
    </div>
  );
}

function BigMetric({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-3xl border-2 border-black p-4 shadow-[0_3px_0_#000] ${
        highlight ? "bg-[#F8CB1E]" : "bg-white"
      }`}
    >
      <div className={`text-xs font-semibold ${highlight ? "text-black/70" : "text-qf-ink2"}`}>{label}</div>
      <div className="text-2xl font-black text-qf-ink mt-1 tnum">{value}</div>
      {sub && <div className={`text-[11px] mt-0.5 ${highlight ? "text-black/60" : "text-qf-ink2"}`}>{sub}</div>}
    </div>
  );
}

function QrRow({ c, slug }: { c: QrPerformanceRow; slug: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${typeof window !== "undefined" ? window.location.origin : ""}/r/${slug}/q/${c.code}`;
  return (
    <div className="rounded-2xl border border-qf-line p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-sm text-qf-ink truncate">{c.name}</div>
          <button
            onClick={() => {
              navigator.clipboard?.writeText(url).then(
                () => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                },
                () => {},
              );
            }}
            className="text-[11px] text-qf-ink2 inline-flex items-center gap-1 mt-0.5"
          >
            <IcoCopy s={12} /> {copied ? "הועתק!" : `/r/${slug}/q/${c.code}`}
          </button>
        </div>
        <div className="flex gap-4 text-center shrink-0">
          <Stat n={c.scans} l="סריקות" />
          <Stat n={c.signups} l="הרשמות" />
          <Stat n={c.firstOrders} l="הזמנות" />
          <Stat n={c.repeatOrders} l="חוזרות" />
        </div>
      </div>
    </div>
  );
}

function Stat({ n, l }: { n: number; l: string }) {
  return (
    <div>
      <div className="font-black text-sm text-qf-ink tnum">{n}</div>
      <div className="text-[10px] text-qf-ink2">{l}</div>
    </div>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return <div className="text-sm text-qf-ink2 bg-qf-bg rounded-2xl px-4 py-5 text-center">{children}</div>;
}
