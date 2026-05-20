"use client";

import { useState } from "react";
import { IcoMegaphone, IcoPlus, IcoEdit, IcoTrash, IcoClose } from "@/components/shared/Icons";
import { ImageUploader } from "@/components/shared/ImageUploader";
import { RelativeTime } from "@/components/shared/RelativeTime";
import { cn } from "@/lib/cn";

interface Campaign {
  id: string;
  title: string;
  imageUrl: string;
  isActive: boolean;
  linkUrl: string | null;
  updatedAt: string;
}

type DraftCampaign = {
  id?: string;
  title: string;
  imageUrl: string;
  isActive: boolean;
  linkUrl: string;
};

const EMPTY_DRAFT: DraftCampaign = {
  title: "",
  imageUrl: "",
  isActive: true,
  linkUrl: "",
};

export function CampaignsView({ initial }: { initial: Campaign[] }) {
  const [items, setItems] = useState(initial);
  const [editing, setEditing] = useState<DraftCampaign | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openNew() {
    setError(null);
    setEditing({ ...EMPTY_DRAFT });
  }

  function openEdit(c: Campaign) {
    setError(null);
    setEditing({
      id: c.id,
      title: c.title,
      imageUrl: c.imageUrl,
      isActive: c.isActive,
      linkUrl: c.linkUrl ?? "",
    });
  }

  async function save() {
    if (!editing) return;
    if (!editing.title.trim()) {
      setError("נדרשת כותרת");
      return;
    }
    if (!editing.imageUrl) {
      setError("נדרשת תמונה");
      return;
    }
    setSaving(true);
    setError(null);
    const isCreate = !editing.id;
    const url = isCreate
      ? "/api/v1/merchant/campaigns"
      : `/api/v1/merchant/campaigns/${editing.id}`;
    const res = await fetch(url, {
      method: isCreate ? "POST" : "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: editing.title.trim(),
        image_url: editing.imageUrl,
        is_active: editing.isActive,
        link_url: editing.linkUrl.trim() || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      setError(e?.error?.message ?? "שמירה נכשלה");
      return;
    }
    const data = await res.json();
    const saved = data.campaign as {
      id: string;
      title: string;
      imageUrl: string;
      isActive: boolean;
      linkUrl: string | null;
      updatedAt: string;
    };
    const mapped: Campaign = {
      id: saved.id,
      title: saved.title,
      imageUrl: saved.imageUrl,
      isActive: saved.isActive,
      linkUrl: saved.linkUrl,
      updatedAt: saved.updatedAt,
    };
    setItems((prev) => {
      const without = prev.filter((c) => c.id !== mapped.id);
      return [mapped, ...without].sort((a, b) =>
        a.isActive === b.isActive
          ? b.updatedAt.localeCompare(a.updatedAt)
          : a.isActive
            ? -1
            : 1,
      );
    });
    setEditing(null);
  }

  async function toggleActive(c: Campaign) {
    const next = !c.isActive;
    setItems((prev) => prev.map((x) => (x.id === c.id ? { ...x, isActive: next } : x)));
    const res = await fetch(`/api/v1/merchant/campaigns/${c.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ is_active: next }),
    });
    if (!res.ok) {
      setItems((prev) => prev.map((x) => (x.id === c.id ? { ...x, isActive: !next } : x)));
    }
  }

  async function remove(c: Campaign) {
    if (!confirm(`למחוק את "${c.title}"?`)) return;
    const prev = items;
    setItems(items.filter((x) => x.id !== c.id));
    const res = await fetch(`/api/v1/merchant/campaigns/${c.id}`, { method: "DELETE" });
    if (!res.ok) setItems(prev);
  }

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">קמפיינים</h1>
          <p className="text-sm text-qf-mute">פופאפ מבצע שמופיע ללקוחות בעמוד הבית של המסעדה.</p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="bg-(--qf-primary) hover:bg-(--qf-deep) text-white rounded-xl px-4 py-2.5 text-sm font-semibold inline-flex items-center gap-1.5 shadow-sm transition"
        >
          <IcoPlus c="#fff" s={16} />
          קמפיין חדש
        </button>
      </header>

      {items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-qf-line-dash p-10 text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-qf-green-soft grid place-items-center mb-3">
            <IcoMegaphone c="var(--qf-primary)" s={26} />
          </div>
          <div className="font-semibold">עדיין אין קמפיינים</div>
          <p className="text-sm text-qf-mute mt-1">
            צור קמפיין כדי להציג ללקוחות מבצע, חידוש או הודעה.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {items.map((c) => (
            <article
              key={c.id}
              className={cn(
                "bg-white rounded-2xl border overflow-hidden flex flex-col",
                c.isActive ? "border-qf-line-dash" : "border-qf-line opacity-70",
              )}
            >
              <div className="aspect-4/3 bg-qf-line-soft relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.imageUrl} alt={c.title} className="w-full h-full object-cover" />
                <span
                  className={cn(
                    "absolute top-2 inset-s-2 text-[10px] font-semibold px-2 py-1 rounded-full",
                    c.isActive
                      ? "bg-qf-green-deep text-white"
                      : "bg-qf-line-soft text-qf-ink2",
                  )}
                >
                  {c.isActive ? "פעיל" : "כבוי"}
                </span>
              </div>
              <div className="p-3 flex-1 flex flex-col gap-2">
                <div className="font-semibold leading-tight">{c.title}</div>
                {c.linkUrl && (
                  <div className="text-xs text-qf-ink2 truncate" dir="ltr">
                    {c.linkUrl}
                  </div>
                )}
                <div className="text-[11px] text-qf-mute">
                  עודכן <RelativeTime date={c.updatedAt} />
                </div>
                <div className="mt-auto pt-2 flex items-center justify-between gap-2 border-t border-qf-line-soft">
                  <label className="inline-flex items-center gap-2 text-xs cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={c.isActive}
                      onChange={() => toggleActive(c)}
                      className="accent-(--qf-primary)"
                    />
                    פעיל
                  </label>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(c)}
                      className="w-8 h-8 grid place-items-center rounded-lg hover:bg-qf-line-soft"
                      aria-label="ערוך"
                    >
                      <IcoEdit s={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(c)}
                      className="w-8 h-8 grid place-items-center rounded-lg hover:bg-qf-tomato-soft"
                      aria-label="מחק"
                    >
                      <IcoTrash c="#c2421f" s={15} />
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {editing && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm grid place-items-center p-4"
          onClick={(e) => e.target === e.currentTarget && setEditing(null)}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-qf-line">
              <h2 className="font-semibold text-lg">
                {editing.id ? "עריכת קמפיין" : "קמפיין חדש"}
              </h2>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="w-8 h-8 rounded-full grid place-items-center hover:bg-qf-line-soft"
                aria-label="סגור"
              >
                <IcoClose s={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1">
                  כותרת פנימית <span className="text-qf-tomato">*</span>
                </label>
                <input
                  type="text"
                  value={editing.title}
                  maxLength={120}
                  onChange={(e) =>
                    setEditing((prev) => prev && { ...prev, title: e.target.value })
                  }
                  placeholder="לדוגמה: שעת הבצק"
                  className="w-full border border-qf-line rounded-xl px-3 py-2.5 text-sm outline-none focus:border-(--qf-primary)"
                />
                <p className="text-[11px] text-qf-mute mt-1">
                  משמש רק לזיהוי פנימי. הלקוח רואה את התמונה בלבד.
                </p>
              </div>

              <div>
                <label className="text-sm font-medium block mb-1">
                  תמונת הפופאפ <span className="text-qf-tomato">*</span>
                </label>
                <ImageUploader
                  type="campaign_image"
                  value={editing.imageUrl ? [editing.imageUrl] : []}
                  onChange={(next) =>
                    setEditing((prev) => prev && { ...prev, imageUrl: next[0] ?? "" })
                  }
                  multiple={false}
                  max={1}
                />
                <p className="text-[11px] text-qf-mute mt-1">
                  מומלץ יחס 4:5 או 1:1. תכלול את הכותרת והפרטים על התמונה עצמה.
                </p>
              </div>

              <div>
                <label className="text-sm font-medium block mb-1">קישור (אופציונלי)</label>
                <input
                  type="text"
                  value={editing.linkUrl}
                  dir="ltr"
                  onChange={(e) =>
                    setEditing((prev) => prev && { ...prev, linkUrl: e.target.value })
                  }
                  placeholder="/menu  או  https://example.com"
                  className="w-full border border-qf-line rounded-xl px-3 py-2.5 text-sm outline-none focus:border-(--qf-primary)"
                />
                <p className="text-[11px] text-qf-mute mt-1">
                  אם תמלא — לחיצה על התמונה תנווט לקישור. השאר ריק כדי שהתמונה תהיה לא־לחיצה.
                </p>
              </div>

              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={editing.isActive}
                  onChange={(e) =>
                    setEditing((prev) => prev && { ...prev, isActive: e.target.checked })
                  }
                  className="accent-(--qf-primary) w-4 h-4"
                />
                פעיל — מציג ללקוחות
              </label>

              {error && (
                <div className="text-xs bg-qf-tomato-soft border border-qf-tomato/40 text-qf-tomato rounded-lg px-3 py-2">
                  {error}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-qf-line bg-qf-bg/40">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-4 py-2 rounded-xl text-sm text-qf-ink2 hover:bg-qf-line-soft"
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="bg-(--qf-primary) hover:bg-(--qf-deep) text-white rounded-xl px-5 py-2 text-sm font-semibold disabled:opacity-60"
              >
                {saving ? "שומר..." : "שמור"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
