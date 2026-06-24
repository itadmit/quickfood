"use client";

import { useState } from "react";
import { IcoStar } from "@/components/shared/Icons";
import { Toast, type ToastState, type ToastKind } from "@/components/shared/Toast";
import { RelativeTime } from "@/components/shared/RelativeTime";
import { PageHeader } from "@/components/merchant/v2/PageHeader";

interface Summary {
  count: number;
  average: number;
  distribution: number[]; // index 0..4 for ratings 1..5
}

interface Review {
  id: string;
  rating: number;
  text: string;
  replyText: string | null;
  replyAt: string | null;
  createdAt: string;
  customerName: string;
  orderNumber: string | null;
}

export function ReviewsView({ summary, reviews }: { summary: Summary; reviews: Review[] }) {
  const [items, setItems] = useState(reviews);
  const [toast, setToast] = useState<ToastState | null>(null);
  function pushToast(kind: ToastKind, message: string) {
    setToast({ id: Date.now(), kind, message });
  }

  async function reply(id: string, text: string) {
    if (!text.trim()) return;
    const res = await fetch(`/api/v1/merchant/reviews/${id}/reply`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      pushToast("err", body?.error?.message ?? "שליחת התשובה נכשלה");
      return;
    }
    const data = await res.json();
    setItems((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, replyText: data.review.reply_text, replyAt: data.review.reply_at } : r,
      ),
    );
    pushToast("ok", "התשובה פורסמה");
  }

  const maxDist = Math.max(1, ...summary.distribution);

  return (
    <div className="space-y-5">
      <PageHeader
        chip="קהילה"
        title="ביקורות"
        subtitle={`${summary.count} ביקורות גלויות`}
        actions={
          <a
            href="/dashboard/messaging"
            className="inline-flex items-center gap-1.5 bg-black text-[#F8CB1E] text-sm font-bold px-3.5 py-2 rounded-xl shadow-[0_2px_0_#000] hover:opacity-90"
          >
            הגדרות ביקורות
          </a>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-3 lg:gap-4">
        <aside className="bg-white rounded-2xl border border-qf-line-dash p-5 h-fit">
          <div className="text-center">
            <div className="text-5xl font-bold tnum">{summary.average.toFixed(1)}</div>
            <Stars value={summary.average} size={20} />
            <div className="text-xs text-qf-mute mt-1">מתוך {summary.count} ביקורות</div>
          </div>
          <div className="mt-5 space-y-1.5">
            {[5, 4, 3, 2, 1].map((rating) => {
              const count = summary.distribution[rating - 1];
              const pct = (count / maxDist) * 100;
              return (
                <div key={rating} className="flex items-center gap-2 text-xs">
                  <div className="tnum w-3 text-qf-ink2">{rating}</div>
                  <IcoStar c="#e8a93b" fill="#e8a93b" s={12} />
                  <div className="flex-1 h-1.5 bg-qf-line-soft rounded-full overflow-hidden">
                    <div
                      className="h-full bg-qf-yolk rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="tnum w-8 text-qf-mute text-end">{count}</div>
                </div>
              );
            })}
          </div>
        </aside>

        <div className="space-y-3">
          {items.length === 0 ? (
            <div className="bg-white rounded-2xl border border-qf-line-dash p-10 text-center text-qf-mute">
              אין ביקורות עדיין. ביקורות יופיעו כאן אחרי שלקוחות ידרגו את ההזמנה שלהם.
            </div>
          ) : (
            items.map((r) => <ReviewCard key={r.id} review={r} onReply={reply} />)
          )}
        </div>
      </div>
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}

function ReviewCard({
  review,
  onReply,
}: {
  review: Review;
  onReply: (id: string, text: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  async function submit() {
    setSending(true);
    await onReply(review.id, text);
    setSending(false);
    setEditing(false);
    setText("");
  }

  return (
    <article className="bg-white rounded-2xl border border-qf-line-dash p-4 space-y-3">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-(--qf-primary) text-white grid place-items-center font-bold text-sm">
            {review.customerName.slice(0, 2)}
          </div>
          <div>
            <div className="font-medium text-sm">{review.customerName}</div>
            <div className="text-xs text-qf-mute">
              <RelativeTime date={review.createdAt} />
              {review.orderNumber && ` · #${review.orderNumber}`}
            </div>
          </div>
        </div>
        <Stars value={review.rating} size={14} />
      </header>

      {review.text && <p className="text-sm text-qf-ink2 leading-relaxed">{review.text}</p>}

      {review.replyText ? (
        <div className="bg-qf-green-soft border-s-4 border-(--qf-primary) rounded-e-lg ps-3 py-2 text-sm">
          <div className="text-xs text-qf-green-deep font-medium">תשובת המסעדה</div>
          <div className="mt-0.5 text-qf-ink2">{review.replyText}</div>
        </div>
      ) : editing ? (
        <div className="space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            placeholder="תשובה ללקוח..."
            className="w-full bg-qf-line-soft/40 border border-qf-line-dash rounded-xl px-3 py-2 text-sm outline-none focus:border-(--qf-primary)"
          />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setText("");
              }}
              className="px-3 py-1.5 rounded-lg border border-qf-line-dash text-sm"
            >
              ביטול
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!text.trim() || sending}
              className="px-3 py-1.5 rounded-lg bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm disabled:opacity-60"
            >
              {sending ? "שולח..." : "שלח תשובה"}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs text-(--qf-deep) underline"
        >
          השב לביקורת
        </button>
      )}
    </article>
  );
}

function Stars({ value, size }: { value: number; size: number }) {
  const full = Math.floor(value);
  return (
    <div className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = i <= full;
        return (
          <IcoStar
            key={i}
            c={filled ? "#e8a93b" : "#cfcec9"}
            fill={filled ? "#e8a93b" : "none"}
            s={size}
          />
        );
      })}
    </div>
  );
}
