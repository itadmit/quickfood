"use client";

import { useState } from "react";
import { IcoMegaphone, IcoPlus, IcoEdit, IcoTrash, IcoClose, IcoCheck } from "@/components/shared/Icons";
import { ImageUploader } from "@/components/shared/ImageUploader";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Toast, type ToastState, type ToastKind } from "@/components/shared/Toast";
import { RelativeTime } from "@/components/shared/RelativeTime";
import { PageHeader } from "@/components/merchant/v2/PageHeader";
import {
  CATEGORY_ICONS,
  CATEGORY_COLORS,
  type CategoryIconKey,
  type CategoryColorKey,
  resolveCategoryStyle,
} from "@/lib/category-style";
import { cn } from "@/lib/cn";

type CampaignKind = "popup" | "banner";
type CampaignStyle = "image" | "text";

interface Campaign {
  id: string;
  kind: CampaignKind;
  style: CampaignStyle;
  title: string;
  subtitle: string | null;
  icon: string | null;
  color: string | null;
  imageUrl: string | null;
  isActive: boolean;
  linkUrl: string | null;
  updatedAt: string;
}

type DraftCampaign = {
  id?: string;
  kind: CampaignKind;
  style: CampaignStyle;
  title: string;
  subtitle: string;
  icon: string | null;
  color: string | null;
  imageUrl: string;
  isActive: boolean;
  linkUrl: string;
};

const EMPTY_DRAFT: DraftCampaign = {
  kind: "popup",
  style: "image",
  title: "",
  subtitle: "",
  icon: null,
  color: null,
  imageUrl: "",
  isActive: true,
  linkUrl: "",
};

const KIND_LABEL: Record<CampaignKind, string> = {
  popup: "פופאפ",
  banner: "באנר",
};

const STYLE_LABEL: Record<CampaignStyle, string> = {
  image: "תמונה",
  text: "כיתוב",
};

/** Text-style banners are the only campaign that doesn't need an image. */
function needsImage(d: { kind: CampaignKind; style: CampaignStyle }) {
  return !(d.kind === "banner" && d.style === "text");
}

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
      kind: c.kind,
      style: c.style,
      title: c.title,
      subtitle: c.subtitle ?? "",
      icon: c.icon,
      color: c.color,
      imageUrl: c.imageUrl ?? "",
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
    if (needsImage(editing) && !editing.imageUrl) {
      setError("נדרשת תמונה");
      return;
    }
    setSaving(true);
    setError(null);
    const isCreate = !editing.id;
    const url = isCreate
      ? "/api/v1/merchant/campaigns"
      : `/api/v1/merchant/campaigns/${editing.id}`;
    // Effective style: popups are always image-style, regardless of UI state.
    const effectiveStyle: CampaignStyle = editing.kind === "popup" ? "image" : editing.style;
    const res = await fetch(url, {
      method: isCreate ? "POST" : "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: editing.kind,
        style: effectiveStyle,
        title: editing.title.trim(),
        subtitle: editing.subtitle.trim() || null,
        icon: editing.icon,
        color: editing.color,
        image_url: editing.imageUrl || null,
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
      kind: CampaignKind;
      style: CampaignStyle;
      title: string;
      subtitle: string | null;
      icon: string | null;
      color: string | null;
      imageUrl: string | null;
      isActive: boolean;
      linkUrl: string | null;
      updatedAt: string;
    };
    const mapped: Campaign = {
      id: saved.id,
      kind: saved.kind,
      style: saved.style,
      title: saved.title,
      subtitle: saved.subtitle,
      icon: saved.icon,
      color: saved.color,
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

  const [pendingDelete, setPendingDelete] = useState<Campaign | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  function pushToast(kind: ToastKind, message: string) {
    setToast({ id: Date.now(), kind, message });
  }

  function startDelete(c: Campaign) {
    setPendingDelete(c);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const c = pendingDelete;
    setDeleting(true);
    const prev = items;
    setItems(items.filter((x) => x.id !== c.id));
    const res = await fetch(`/api/v1/merchant/campaigns/${c.id}`, { method: "DELETE" });
    setDeleting(false);
    setPendingDelete(null);
    if (!res.ok) {
      setItems(prev);
      const body = await res.json().catch(() => ({}));
      pushToast("err", body?.error?.message ?? "מחיקת קמפיין נכשלה");
      return;
    }
    pushToast("ok", "הקמפיין נמחק");
  }

  return (
    <div className="space-y-5">
      <PageHeader
        chip="שיווק"
        title="קמפיינים"
        subtitle="פופאפ צף או באנר קידום בתוך עמוד הבית"
        actions={
          <button
            type="button"
            onClick={openNew}
            className="bg-black text-[#F8CB1E] border-2 border-black rounded-xl px-4 py-2 text-sm font-bold inline-flex items-center justify-center gap-1.5 shadow-[0_2px_0_#000] hover:bg-black/90"
          >
            <IcoPlus c="#F8CB1E" s={16} />
            קמפיין חדש
          </button>
        }
      />

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
              <div className="h-44 bg-qf-line-soft relative overflow-hidden shrink-0">
                {c.kind === "banner" && c.style === "text" ? (
                  <ThumbTextBanner
                    title={c.title}
                    subtitle={c.subtitle}
                    icon={c.icon}
                    color={c.color}
                  />
                ) : c.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.imageUrl}
                    alt={c.title}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : null}
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
                <span
                  className={cn(
                    "absolute top-2 inset-e-2 text-[10px] font-semibold px-2 py-1 rounded-full",
                    c.kind === "popup"
                      ? "bg-qf-blue-soft text-qf-blue"
                      : "bg-qf-yolk-soft text-qf-ink2",
                  )}
                >
                  {KIND_LABEL[c.kind]}
                  {c.kind === "banner" ? ` · ${STYLE_LABEL[c.style]}` : ""}
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
                      onClick={() => startDelete(c)}
                      className="w-8 h-8 grid place-items-center rounded-lg hover:bg-qf-tomato-soft"
                      aria-label="מחק קמפיין"
                      title="מחק קמפיין"
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
                <label className="text-sm font-medium block mb-1.5">
                  סוג קמפיין <span className="text-qf-tomato">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2 bg-qf-line-soft p-1 rounded-xl">
                  {(["popup", "banner"] as const).map((k) => {
                    const active = editing.kind === k;
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() =>
                          setEditing((prev) => prev && { ...prev, kind: k })
                        }
                        className={cn(
                          "px-3 py-2 rounded-lg text-sm font-semibold transition",
                          active
                            ? "bg-white shadow-sm text-qf-ink"
                            : "text-qf-ink2 hover:text-qf-ink",
                        )}
                      >
                        {KIND_LABEL[k]}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-qf-mute mt-1.5">
                  {editing.kind === "popup"
                    ? "פופאפ מופיע פעם ביום ללקוח כשהוא נכנס לעמוד הבית."
                    : "באנר מופיע משובץ בעמוד הבית, בלי הפרעה לגלילה."}
                </p>
              </div>

              {editing.kind === "banner" && (
                <div>
                  <label className="text-sm font-medium block mb-1.5">
                    סגנון באנר <span className="text-qf-tomato">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2 bg-qf-line-soft p-1 rounded-xl">
                    {(["image", "text"] as const).map((s) => {
                      const active = editing.style === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() =>
                            setEditing((prev) => prev && { ...prev, style: s })
                          }
                          className={cn(
                            "px-3 py-2 rounded-lg text-sm font-semibold transition",
                            active
                              ? "bg-white shadow-sm text-qf-ink"
                              : "text-qf-ink2 hover:text-qf-ink",
                          )}
                        >
                          {STYLE_LABEL[s]}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-qf-mute mt-1.5">
                    {editing.style === "image"
                      ? "באנר תמונה — מעלים תמונה רחבה שכוללת את כל הטקסט."
                      : "באנר כיתוב — כרטיס עם כותרת, תיאור ואייקון; ללא צורך בתמונה."}
                  </p>
                </div>
              )}

              <div>
                <label className="text-sm font-medium block mb-1">
                  {editing.kind === "banner" && editing.style === "text"
                    ? "כותרת"
                    : "כותרת פנימית"}{" "}
                  <span className="text-qf-tomato">*</span>
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
                  {editing.kind === "banner" && editing.style === "text"
                    ? "מופיע ככותרת הראשית בבאנר ללקוח."
                    : "משמש רק לזיהוי פנימי. הלקוח רואה את התמונה בלבד."}
                </p>
              </div>

              {editing.kind === "banner" && editing.style === "text" && (
                <>
                  <div>
                    <label className="text-sm font-medium block mb-1">
                      תיאור (אופציונלי)
                    </label>
                    <input
                      type="text"
                      value={editing.subtitle}
                      maxLength={160}
                      onChange={(e) =>
                        setEditing((prev) => prev && { ...prev, subtitle: e.target.value })
                      }
                      placeholder="לדוגמה: 1+1 על קלאסיות · כל יום 14:00–17:00"
                      className="w-full border border-qf-line rounded-xl px-3 py-2.5 text-sm outline-none focus:border-(--qf-primary)"
                    />
                    <p className="text-[11px] text-qf-mute mt-1">
                      שורה שנייה קטנה מתחת לכותרת. השאר ריק להסתרה.
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium block mb-2">צבע</label>
                    <div className="grid grid-cols-8 gap-2">
                      {(Object.keys(CATEGORY_COLORS) as CategoryColorKey[]).map((key) => {
                        const c = CATEGORY_COLORS[key];
                        const active = editing.color === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() =>
                              setEditing((prev) => prev && { ...prev, color: key })
                            }
                            aria-label={c.label}
                            aria-pressed={active}
                            className={cn(
                              "aspect-square rounded-full grid place-items-center transition",
                              active ? "ring-2 ring-offset-2 ring-qf-ink" : "hover:scale-110",
                            )}
                            style={{ backgroundColor: c.bg }}
                          >
                            {active && <IcoCheck c={c.fg} s={14} />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium block mb-2">אייקון</label>
                    <div className="grid grid-cols-8 gap-2">
                      {(Object.keys(CATEGORY_ICONS) as CategoryIconKey[]).map((key) => {
                        const I = CATEGORY_ICONS[key].Icon;
                        const active = editing.icon === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() =>
                              setEditing((prev) => prev && { ...prev, icon: key })
                            }
                            title={CATEGORY_ICONS[key].label}
                            aria-pressed={active}
                            className={cn(
                              "aspect-square rounded-xl grid place-items-center transition",
                              active
                                ? "bg-(--qf-primary) text-white"
                                : "bg-qf-line-soft/70 hover:bg-qf-line-soft text-qf-ink2",
                            )}
                          >
                            <I size={18} strokeWidth={1.8} />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <BannerPreview draft={editing} />
                </>
              )}

              {needsImage(editing) && (
                <div>
                  <label className="text-sm font-medium block mb-1">
                    תמונה <span className="text-qf-tomato">*</span>
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
                    {editing.kind === "popup"
                      ? "מומלץ יחס 4:5 או 1:1. כלול את הכותרת והפרטים על התמונה עצמה."
                      : "מומלץ יחס 16:9 או 21:9 — באנר רחב משובץ. כלול את הכותרת והפרטים על התמונה עצמה."}
                  </p>
                </div>
              )}

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
                  אם תמלא — לחיצה על הקמפיין תנווט לקישור. השאר ריק כדי שלא יהיה לחיץ.
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

      <ConfirmDialog
        open={!!pendingDelete}
        title="מחיקת קמפיין"
        message={
          <>
            הקמפיין <span className="font-semibold">&quot;{pendingDelete?.title}&quot;</span> יימחק. פעולה זו אינה ניתנת לביטול.
          </>
        }
        confirmLabel="מחק"
        cancelLabel="ביטול"
        variant="danger"
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}

/** Live mini-preview of the customer-facing text banner inside the editor. */
function BannerPreview({ draft }: { draft: DraftCampaign }) {
  const style = resolveCategoryStyle(draft.icon, draft.color);
  const Icon = style.Icon;
  return (
    <div>
      <div className="text-xs font-medium text-qf-mute mb-1.5">תצוגה מקדימה</div>
      <div
        className="rounded-2xl border border-qf-line p-4 flex items-center gap-3 shadow-sm"
        style={{ backgroundColor: style.bg }}
      >
        <div
          className="rounded-xl p-3 shrink-0"
          style={{ backgroundColor: "rgba(255,255,255,0.55)" }}
        >
          <Icon size={28} color={style.fg} strokeWidth={1.8} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold leading-tight truncate" style={{ color: style.fg }}>
            {draft.title || "כותרת"}
          </div>
          {draft.subtitle && (
            <div className="text-xs text-qf-ink2 mt-0.5 truncate">{draft.subtitle}</div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Card thumbnail when there's no uploaded image — mirrors the customer banner. */
function ThumbTextBanner({
  title,
  subtitle,
  icon,
  color,
}: {
  title: string;
  subtitle: string | null;
  icon: string | null;
  color: string | null;
}) {
  const style = resolveCategoryStyle(icon, color);
  const Icon = style.Icon;
  return (
    <div
      className="absolute inset-3 rounded-xl border border-qf-line p-3 flex items-center gap-3 shadow-sm"
      style={{ backgroundColor: style.bg }}
    >
      <div
        className="rounded-lg p-2 shrink-0"
        style={{ backgroundColor: "rgba(255,255,255,0.55)" }}
      >
        <Icon size={20} color={style.fg} strokeWidth={1.8} />
      </div>
      <div className="min-w-0">
        <div className="font-semibold leading-tight truncate" style={{ color: style.fg }}>
          {title}
        </div>
        {subtitle && <div className="text-xs text-qf-ink2 truncate">{subtitle}</div>}
      </div>
    </div>
  );
}
