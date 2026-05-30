"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { IcoCheck } from "@/components/shared/Icons";

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

interface VenueInfoPreview {
  wolt: {
    name: string;
    about: string | null;
    address: string | null;
    phone: string | null;
    coverImageUrl: string | null;
    logoImageUrl: string | null;
    hours: Array<{ day: string; label: string; display: string; active: boolean }>;
    hasHours: boolean;
  };
  current: {
    name: string;
    about: string | null;
    address: string | null;
    phone: string | null;
    coverImage: string | null;
    logoUrl: string | null;
    hasHours: boolean;
  };
}

interface Preview {
  importId: string;
  venueName: string;
  categoriesCount: number;
  itemsCount: number;
  optionsCount: number;
  imagesCount: number;
  sampleItems: Array<{ name: string; image: string | null; price: number }>;
  venueInfo: VenueInfoPreview;
}

type VenueField = "about" | "address" | "phone" | "hours" | "cover" | "logo";

interface CommitResult {
  categoriesImported: number;
  itemsImported: number;
  imagesUploaded: number;
  venueInfoApplied: string[];
  errors: Array<{ context: string; message: string }>;
}

type Stage = "form" | "preview" | "committing" | "done";

export function WoltImportClient({ lastImport }: { lastImport: LastImport | null }) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("form");
  const [url, setUrl] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<CommitResult | null>(null);
  const [applyFlags, setApplyFlags] = useState<Record<VenueField, boolean>>({
    about: false, address: false, phone: false, hours: false, cover: false, logo: false,
  });

  async function onPreview(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!acknowledged) {
      setError("יש לאשר שאתם בעלי החנות לפני שמייבאים");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/v1/merchant/import/wolt/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source_url: url.trim() }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.message || "שליפת התפריט מוולט נכשלה");
        return;
      }
      const p: Preview = body.preview;
      setPreview(p);
      setApplyFlags({
        about: !!p.venueInfo.wolt.about && !p.venueInfo.current.about,
        address: !!p.venueInfo.wolt.address && !p.venueInfo.current.address,
        phone: !!p.venueInfo.wolt.phone && !p.venueInfo.current.phone,
        hours: p.venueInfo.wolt.hasHours && !p.venueInfo.current.hasHours,
        cover: !!p.venueInfo.wolt.coverImageUrl && !p.venueInfo.current.coverImage,
        logo: !!p.venueInfo.wolt.logoImageUrl && !p.venueInfo.current.logoUrl,
      });
      setStage("preview");
    } finally {
      setBusy(false);
    }
  }

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
                  : "טיוטה — לא הושלם"}
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
              ואני מאשר/ת ייבוא שלו ל-QuickFood.
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

const FIELD_LABELS: Record<string, string> = {
  about: "תיאור העסק",
  address: "כתובת",
  phone: "טלפון",
  hours: "שעות פעילות",
  cover: "תמונת כריכה",
  logo: "לוגו",
};

function venueFieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

function VenueInfoPicker({
  info,
  flags,
  onToggle,
}: {
  info: VenueInfoPreview;
  flags: Record<VenueField, boolean>;
  onToggle: (k: VenueField) => void;
}) {
  const { wolt, current } = info;
  const rows: Array<{
    key: VenueField;
    label: string;
    available: boolean;
    woltDisplay: React.ReactNode;
    currentDisplay: React.ReactNode;
    overwrite: boolean;
  }> = [
    {
      key: "about",
      label: "תיאור העסק",
      available: !!wolt.about,
      overwrite: !!wolt.about && !!current.about,
      woltDisplay: wolt.about
        ? <span className="line-clamp-3 leading-relaxed whitespace-pre-line">{wolt.about}</span>
        : <em className="text-qf-mute">אין תיאור בוולט</em>,
      currentDisplay: current.about
        ? <span className="line-clamp-3 leading-relaxed whitespace-pre-line">{current.about}</span>
        : <em className="text-qf-mute">ריק</em>,
    },
    {
      key: "address",
      label: "כתובת",
      available: !!wolt.address,
      overwrite: !!wolt.address && !!current.address,
      woltDisplay: wolt.address ?? <em className="text-qf-mute">—</em>,
      currentDisplay: current.address ?? <em className="text-qf-mute">ריק</em>,
    },
    {
      key: "phone",
      label: "טלפון",
      available: !!wolt.phone,
      overwrite: !!wolt.phone && !!current.phone,
      woltDisplay: wolt.phone
        ? <span dir="ltr" className="tnum">{wolt.phone}</span>
        : <em className="text-qf-mute">—</em>,
      currentDisplay: current.phone
        ? <span dir="ltr" className="tnum">{current.phone}</span>
        : <em className="text-qf-mute">ריק</em>,
    },
    {
      key: "hours",
      label: "שעות פעילות",
      available: wolt.hasHours,
      overwrite: wolt.hasHours && current.hasHours,
      woltDisplay: wolt.hasHours ? (
        <ul className="text-xs space-y-0.5">
          {wolt.hours.map((h) => (
            <li key={h.day} className="flex items-baseline gap-2 tnum">
              <span className="text-qf-mute w-12">{h.label}</span>
              <span className={h.active ? "" : "text-qf-mute"}>{h.display}</span>
            </li>
          ))}
        </ul>
      ) : (
        <em className="text-qf-mute">אין שעות בוולט</em>
      ),
      currentDisplay: current.hasHours ? "מוגדרות" : <em className="text-qf-mute">ריק</em>,
    },
    {
      key: "cover",
      label: "תמונת כריכה",
      available: !!wolt.coverImageUrl,
      overwrite: !!wolt.coverImageUrl && !!current.coverImage,
      woltDisplay: wolt.coverImageUrl ? (
        <div className="relative w-32 h-16 rounded-lg overflow-hidden bg-qf-line-soft">
          <Image src={wolt.coverImageUrl} alt="" fill sizes="128px" className="object-cover" unoptimized />
        </div>
      ) : <em className="text-qf-mute">—</em>,
      currentDisplay: current.coverImage ? (
        <div className="relative w-32 h-16 rounded-lg overflow-hidden bg-qf-line-soft">
          <Image src={current.coverImage} alt="" fill sizes="128px" className="object-cover" unoptimized />
        </div>
      ) : <em className="text-qf-mute">ריק</em>,
    },
    {
      key: "logo",
      label: "לוגו",
      available: !!wolt.logoImageUrl,
      overwrite: !!wolt.logoImageUrl && !!current.logoUrl,
      woltDisplay: wolt.logoImageUrl ? (
        <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-qf-line-soft">
          <Image src={wolt.logoImageUrl} alt="" fill sizes="48px" className="object-contain" unoptimized />
        </div>
      ) : <em className="text-qf-mute">—</em>,
      currentDisplay: current.logoUrl ? (
        <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-qf-line-soft">
          <Image src={current.logoUrl} alt="" fill sizes="48px" className="object-contain" unoptimized />
        </div>
      ) : <em className="text-qf-mute">ריק</em>,
    },
  ];

  return (
    <div>
      <h3 className="text-sm font-semibold mb-1">פרטי החנות שזוהו בוולט</h3>
      <p className="text-xs text-qf-mute mb-3 leading-relaxed">
        סמנו מה לעדכן ב-QuickFood. שדה שמסומן ושכבר קיים אצלכם — יידרס בערך מוולט.
      </p>
      <div className="border border-qf-line-dash rounded-2xl overflow-hidden bg-white">
        {rows.map((r, idx) => (
          <label
            key={r.key}
            className={cn(
              "grid grid-cols-[auto_1fr_1fr] gap-3 px-3 py-3 items-start text-sm cursor-pointer transition",
              idx > 0 && "border-t border-qf-line-dash",
              !r.available && "opacity-50 cursor-not-allowed",
              r.available && flags[r.key] && "bg-qf-green-soft/40",
            )}
          >
            <input
              type="checkbox"
              disabled={!r.available}
              checked={!!flags[r.key]}
              onChange={() => onToggle(r.key)}
              className="mt-1 accent-(--qf-primary)"
            />
            <div>
              <div className="font-medium flex items-center gap-2 flex-wrap">
                {r.label}
                {r.overwrite && flags[r.key] && (
                  <span className="text-[10px] bg-qf-tomato/15 text-qf-tomato px-1.5 py-0.5 rounded-md">
                    יידרוס קיים
                  </span>
                )}
              </div>
              <div className="text-xs text-qf-mute mt-0.5">מוולט</div>
              <div className="text-sm text-qf-ink2 mt-1">{r.woltDisplay}</div>
            </div>
            <div>
              <div className="text-xs text-qf-mute">ב-QuickFood עכשיו</div>
              <div className="text-sm text-qf-ink2 mt-1">{r.currentDisplay}</div>
            </div>
          </label>
        ))}
      </div>
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
//   .qf-spinner   — defined in globals.css alongside the other qf-*
//   .tnum         — tabular numerals utility, already in use across the app
