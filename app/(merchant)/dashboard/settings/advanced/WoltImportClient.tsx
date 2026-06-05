"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { IcoCheck } from "@/components/shared/Icons";
import {
  VenueInfoPicker,
  defaultApplyFlags,
  venueFieldLabel,
  type VenueApplyFlags,
  type VenueField,
} from "@/components/shared/wolt/VenueInfoPicker";
import { WoltTermsTrigger } from "@/components/shared/wolt/WoltTermsModal";
import type { ImportPreview } from "@/lib/wolt-import/types";

interface LastImport {
  id: string;
  sourceUrl: string;
  venueName: string;
  status: "preview" | "committed" | "failed";
  categoriesImported: number;
  itemsImported: number;
  imagesUploaded: number;
  createdAt: string;
  committedAt: string | null;
}

type Preview = ImportPreview;

interface CommitResult {
  categoriesImported: number;
  itemsImported: number;
  imagesUploaded: number;
  venueInfoApplied: string[];
  errors: Array<{ context: string; message: string }>;
}

type Stage = "form" | "preview" | "committing" | "done";

export function WoltImportClient({
  lastImport,
  initialUrl,
  initialAck,
  autoStart,
}: {
  lastImport: LastImport | null;
  initialUrl?: string;
  initialAck?: boolean;
  autoStart?: boolean;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("form");
  const [url, setUrl] = useState(initialUrl ?? "");
  const [acknowledged, setAcknowledged] = useState(!!initialAck);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<CommitResult | null>(null);
  const [applyFlags, setApplyFlags] = useState<VenueApplyFlags>({
    about: false, address: false, phone: false, hours: false, cover: false, logo: false,
  });

  async function runPreview(targetUrl: string, ack: boolean): Promise<void> {
    setError(null);
    if (!ack) {
      setError("יש לאשר שאתם בעלי החנות לפני שמייבאים");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/v1/merchant/import/wolt/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source_url: targetUrl.trim() }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.message || "שליפת התפריט מוולט נכשלה");
        return;
      }
      const p: Preview = body.preview;
      setPreview(p);
      setApplyFlags(defaultApplyFlags(p.venueInfo));
      setStage("preview");
    } finally {
      setBusy(false);
    }
  }

  async function onPreview(e: React.FormEvent) {
    e.preventDefault();
    await runPreview(url, acknowledged);
  }

  // Auto-start the preview when arriving from the signup hand-off
  // (?wolt=<url>&ack=1&autostart=1). The merchant already acked
  // ownership in signup; we don't ask twice.
  const autoFiredRef = useRef(false);
  useEffect(() => {
    if (autoFiredRef.current) return;
    if (autoStart && initialUrl && initialAck && stage === "form" && !busy) {
      autoFiredRef.current = true;
      queueMicrotask(() => {
        void runPreview(initialUrl, true);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, initialUrl, initialAck]);

  function toggleFlag(k: VenueField) {
    setApplyFlags((prev) => ({ ...prev, [k]: !prev[k] }));
  }

  async function onCommit() {
    if (!preview) return;
    setBusy(true);
    setError(null);
    setStage("committing");
    try {
      const res = await fetch(
        `/api/v1/merchant/import/wolt/${preview.importId}/commit`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ applyVenueInfo: applyFlags }),
        },
      );
      const body = await res.json();
      if (!res.ok) {
        setError(body?.message || "הייבוא נכשל");
        setStage("preview");
        return;
      }
      setResult(body as CommitResult);
      setStage("done");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function onReset() {
    setStage("form");
    setUrl("");
    setAcknowledged(false);
    setPreview(null);
    setResult(null);
    setError(null);
  }

  // ─── STEP 1: URL form ────────────────────────────────────────────
  if (stage === "form") {
    return (
      <div className="space-y-5">
        {lastImport && (
          <div className="bg-qf-bg border border-qf-line-dash rounded-xl px-4 py-3 text-sm">
            <div className="flex items-center gap-2 text-qf-mute text-xs mb-1">
              ייבוא אחרון · {formatRelativeTime(lastImport.createdAt)}
            </div>
            <div className="font-medium">{lastImport.venueName}</div>
            <div className="text-xs text-qf-mute mt-1 tnum">
              {lastImport.status === "committed"
                ? `${lastImport.itemsImported} פריטים · ${lastImport.categoriesImported} קטגוריות · ${lastImport.imagesUploaded} תמונות`
                : lastImport.status === "failed"
                  ? "נכשל"
                  : "טיוטה - לא הושלם"}
            </div>
          </div>
        )}

        <form onSubmit={onPreview} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium">כתובת החנות בוולט</span>
            <input
              type="url"
              required
              dir="ltr"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://wolt.com/he/isr/.../restaurant/your-shop"
              className="mt-1 block w-full rounded-xl border border-qf-line bg-white px-3 py-2.5 text-sm outline-none focus:border-(--qf-primary)"
            />
            <span className="text-xs text-qf-mute mt-1 block">
              העתיקו את הקישור משורת הכתובת בדפדפן אחרי שפתחתם את החנות שלכם בוולט.
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-1 accent-(--qf-primary)"
            />
            <span className="text-sm leading-relaxed">
              אני בעל/ת החנות. התוכן (שמות, תמונות, מחירים, תוספות) שייך לי
              ואני מאשר/ת ייבוא שלו ל-QuickFood. הייבוא הזה באחריותי הבלעדית
              מול Wolt וצדדים שלישיים - ראו{" "}
              <WoltTermsTrigger className="underline font-semibold" />.
            </span>
          </label>

          {error && (
            <div className="bg-qf-tomato/10 border border-qf-tomato/30 text-qf-tomato text-sm rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy || !url || !acknowledged}
            className="bg-(--qf-primary) hover:bg-(--qf-deep) text-white font-semibold px-5 py-2.5 rounded-xl text-sm disabled:opacity-60 transition"
          >
            {busy ? "טוען..." : "שלוף תפריט"}
          </button>
        </form>
      </div>
    );
  }

  // ─── STEP 2: preview + confirm ───────────────────────────────────
  if (stage === "preview" && preview) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="קטגוריות" value={preview.categoriesCount} />
          <Stat label="פריטים" value={preview.itemsCount} />
          <Stat label="תוספות (קבוצות)" value={preview.optionsCount} />
          <Stat label="תמונות" value={preview.imagesCount} />
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-2">דוגמה מהתפריט</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {preview.sampleItems.map((it, i) => (
              <div
                key={i}
                className="bg-white border border-qf-line-dash rounded-xl p-2 flex flex-col"
              >
                <div className="aspect-square rounded-lg bg-qf-line-soft overflow-hidden mb-2 relative">
                  {it.image && (
                    <Image
                      src={it.image}
                      alt={it.name}
                      fill
                      sizes="(max-width: 768px) 50vw, 25vw"
                      className="object-cover"
                      unoptimized
                    />
                  )}
                </div>
                <div className="text-xs font-medium line-clamp-2 leading-snug">{it.name}</div>
                <div className="text-xs text-qf-mute mt-1 tnum">₪{it.price}</div>
              </div>
            ))}
          </div>
        </div>

        <VenueInfoPicker
          info={preview.venueInfo}
          flags={applyFlags}
          onToggle={toggleFlag}
        />

        <div className="bg-qf-bg border border-qf-line-dash rounded-xl p-3 text-xs text-qf-mute leading-relaxed">
          <strong className="text-qf-ink2">לפני שמתחילים:</strong> פריטים
          שכבר יובאו בעבר מאותה חנות יתעדכנו במקום להישכפל. פריטים שיצרתם
          ידנית ב-QuickFood לא יושפעו. מחירים יעוגלו לשקלים שלמים (וולט עובדת
          באגורות).
        </div>

        {error && (
          <div className="bg-qf-tomato/10 border border-qf-tomato/30 text-qf-tomato text-sm rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onReset}
            className="bg-white border border-qf-line text-qf-ink2 hover:border-qf-mute font-medium px-5 py-2.5 rounded-xl text-sm transition"
          >
            בטל
          </button>
          <button
            type="button"
            onClick={onCommit}
            disabled={busy}
            className="bg-(--qf-primary) hover:bg-(--qf-deep) text-white font-semibold px-5 py-2.5 rounded-xl text-sm disabled:opacity-60 transition"
          >
            {busy ? "מייבא..." : "אשר וייבא"}
          </button>
        </div>
      </div>
    );
  }

  // ─── STEP 3: committing (visible until commit returns) ──────────
  if (stage === "committing") {
    return (
      <div className="py-10 flex flex-col items-center justify-center gap-3 text-center">
        <div className="qf-spinner h-9 w-9" />
        <div className="text-sm font-medium">מייבא תפריט והעלאת תמונות...</div>
        <div className="text-xs text-qf-mute">
          זה יכול לקחת 20–60 שניות תלוי בכמות התמונות. אל תסגרו את הדף.
        </div>
      </div>
    );
  }

  // ─── STEP 4: done ────────────────────────────────────────────────
  if (stage === "done" && result) {
    return (
      <div className="space-y-5">
        <div className="bg-qf-green-soft border border-qf-green-deep/20 rounded-xl px-4 py-4 flex items-start gap-3">
          <div className="w-9 h-9 bg-qf-green-deep rounded-full grid place-items-center shrink-0">
            <IcoCheck c="#fff" s={18} />
          </div>
          <div>
            <div className="font-semibold text-qf-green-deep">הייבוא הושלם</div>
            <div className="text-sm text-qf-ink2 mt-1 tnum">
              {result.itemsImported} פריטים · {result.categoriesImported} קטגוריות
              · {result.imagesUploaded} תמונות
            </div>
            {result.venueInfoApplied.length > 0 && (
              <div className="text-sm text-qf-ink2 mt-1">
                עודכנו פרטי החנות: {result.venueInfoApplied.map(venueFieldLabel).join(", ")}
              </div>
            )}
            {result.errors.length > 0 && (
              <details className="mt-2 text-xs">
                <summary className="text-qf-mute cursor-pointer">
                  {result.errors.length} פריטים נכשלו (פתח לפרטים)
                </summary>
                <ul className="mt-2 space-y-1 text-qf-mute">
                  {result.errors.slice(0, 20).map((e, i) => (
                    <li key={i}>
                      <span className="font-medium">{e.context}:</span> {e.message}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <Link
            href="/dashboard/menu"
            className="bg-(--qf-primary) hover:bg-(--qf-deep) text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition"
          >
            לתפריט שלי
          </Link>
          <button
            type="button"
            onClick={onReset}
            className="bg-white border border-qf-line text-qf-ink2 hover:border-qf-mute font-medium px-5 py-2.5 rounded-xl text-sm transition"
          >
            ייבוא נוסף
          </button>
        </div>
      </div>
    );
  }

  return null;
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-qf-bg border border-qf-line-dash rounded-xl p-3 text-center">
      <div className="text-2xl font-bold tnum">{value}</div>
      <div className="text-xs text-qf-mute mt-0.5">{label}</div>
    </div>
  );
}


function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "לפני רגע";
  if (minutes < 60) return `לפני ${minutes} דק׳`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `לפני ${hours} שע׳`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `לפני ${days} ימים`;
  return date.toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem" });
}

// Class names referenced above that we lean on existing in the global
// stylesheet:
//   .qf-spinner   - defined in globals.css alongside the other qf-*
//   .tnum         - tabular numerals utility, already in use across the app
