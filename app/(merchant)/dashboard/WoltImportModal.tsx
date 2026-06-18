"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { IcoArrowLeft, IcoCheck, IcoClose } from "@/components/shared/Icons";
import { Modal } from "@/components/shared/Modal";
import type { ImportPreview } from "@/lib/wolt-import/types";

type Stage = "loading" | "preview" | "committing" | "done" | "error";

interface CommitResult {
  categoriesImported: number;
  itemsImported: number;
  imagesUploaded: number;
}

export function WoltImportModal({
  initialUrl,
  initialAck,
  autoStart,
}: {
  initialUrl: string;
  initialAck: boolean;
  autoStart: boolean;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>(autoStart ? "loading" : "preview");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<CommitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    if (!autoStart || firedRef.current) return;
    firedRef.current = true;
    void fetchPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchPreview() {
    setStage("loading");
    setError(null);
    try {
      const res = await fetch("/api/v1/merchant/import/wolt/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source_url: initialUrl }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.message || "שליפת התפריט מוולט נכשלה");
        setStage("error");
        return;
      }
      setPreview(body.preview as ImportPreview);
      setStage("preview");
    } catch {
      setError("שגיאת רשת, נסו שוב");
      setStage("error");
    }
  }

  async function onCommit() {
    if (!preview) return;
    setStage("committing");
    try {
      const res = await fetch(
        `/api/v1/merchant/import/wolt/${preview.importId}/commit`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ applyVenueInfo: {} }),
        },
      );
      const body = await res.json();
      if (!res.ok) {
        setError(body?.message || "הייבוא נכשל");
        setStage("error");
        return;
      }
      setResult(body as CommitResult);
      setStage("done");
    } catch {
      setError("שגיאת רשת, נסו שוב");
      setStage("error");
    }
  }

  function onClose() {
    router.push("/dashboard");
  }

  const stepLabel: Record<Stage, string> = {
    loading: "שלב 1 מתוך 2 · שליפת תפריט",
    preview: "שלב 1 מתוך 2 · אישור ייבוא",
    committing: "שלב 2 מתוך 2 · מייבא...",
    done: "הושלם",
    error: "שגיאה",
  };

  return (
    <Modal
      open
      onClose={stage === "committing" ? () => {} : onClose}
      size="2xl"
      ariaLabel="ייבוא תפריט מ-Wolt"
      closeOnBackdrop={false}
      panelStyle={{ backgroundColor: "#F8CB1E" }}
      className="overflow-hidden"
    >
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.08]"
        style={{
          backgroundImage: "radial-gradient(circle, #000 1.5px, transparent 1.5px)",
          backgroundSize: "26px 26px",
        }}
        aria-hidden
      />

      {stage !== "committing" && stage !== "done" && (
        <button
          type="button"
          onClick={onClose}
          aria-label="סגור"
          className="absolute top-4 inset-e-4 z-20 w-9 h-9 rounded-full bg-black/10 hover:bg-black/20 grid place-items-center transition"
        >
          <IcoClose c="currentColor" s={18} />
        </button>
      )}

      <div className="relative px-6 py-8 md:px-10 md:py-10 flex flex-col items-center text-center gap-6">
        <div className="flex items-center gap-2">
          <span className="bg-black text-[#F8CB1E] px-2 py-0.5 rounded-md text-[10px] font-black tracking-wide">
            QuickFood
          </span>
          <span className="text-black/60 text-xs font-semibold">{stepLabel[stage]}</span>
        </div>

        {stage === "done" && <Confetti />}

        {stage === "loading" && <LoadingStage />}
        {stage === "preview" && preview && (
          <PreviewStage preview={preview} onConfirm={onCommit} onClose={onClose} />
        )}
        {stage === "committing" && <CommittingStage />}
        {stage === "done" && result && (
          <DoneStage result={result} onGo={() => router.push("/dashboard/menu")} />
        )}
        {stage === "error" && (
          <ErrorStage message={error} onRetry={fetchPreview} onClose={onClose} />
        )}
      </div>
    </Modal>
  );
}

function LoadingStage() {
  return (
    <div className="py-8 flex flex-col items-center gap-4">
      <div className="qf-spinner h-10 w-10 border-black/30 border-t-black" />
      <div className="font-bold text-black">שולף תפריט מוולט...</div>
      <div className="text-sm text-black/60">זה לוקח כמה שניות</div>
    </div>
  );
}

function PreviewStage({
  preview,
  onConfirm,
  onClose,
}: {
  preview: ImportPreview;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <h2 className="text-black font-black text-2xl md:text-3xl leading-tight">
        <span className="bg-black text-[#F8CB1E] px-3 py-0.5 rounded-lg inline-block">
          {preview.venueInfo?.wolt?.name ?? "התפריט מוכן"}
        </span>
        <br />
        <span className="text-black mt-1 inline-block">מוכן לייבוא</span>
      </h2>

      <div className="w-full grid grid-cols-3 gap-3">
        <StatCard value={preview.itemsCount} label="פריטים" />
        <StatCard value={preview.categoriesCount} label="קטגוריות" />
        <StatCard value={preview.imagesCount} label="תמונות" />
      </div>

      {preview.sampleItems.length > 0 && (
        <div className="w-full">
          <div className="text-xs font-bold text-black/60 mb-2 text-start">דוגמה מהתפריט</div>
          <div className="grid grid-cols-4 gap-2">
            {preview.sampleItems.slice(0, 4).map((item, i) => (
              <div key={i} className="bg-white border-2 border-black rounded-2xl p-2 flex flex-col gap-1.5 shadow-[0_3px_0_#000]">
                <div className="aspect-square rounded-xl bg-black/10 overflow-hidden relative">
                  {item.image && (
                    <Image src={item.image} alt={item.name} fill sizes="100px" className="object-cover" unoptimized />
                  )}
                </div>
                <div className="text-[11px] font-semibold leading-snug line-clamp-2 text-black text-start">
                  {item.name}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="w-full flex flex-col gap-2.5">
        <button
          type="button"
          onClick={onConfirm}
          className="w-full py-3.5 rounded-2xl bg-black hover:bg-black/90 text-[#F8CB1E] text-base font-black border-2 border-black shadow-[0_4px_0_#000] hover:shadow-[0_6px_0_#000] hover:-translate-y-0.5 active:translate-y-0 active:shadow-[0_2px_0_#000] transition inline-flex items-center justify-center gap-2"
        >
          ייבא עכשיו
          <IcoArrowLeft c="currentColor" s={18} />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="text-black/55 hover:text-black text-sm font-bold underline underline-offset-4"
        >
          עדיין לא, אייבא אחר כך
        </button>
      </div>
    </>
  );
}

const COMMIT_MESSAGES = [
  "מכינים את התפריט...",
  "מעלים את התמונות...",
  "מסדרים קטגוריות ותוספות...",
  "מתאימים מחירים לשקלים...",
  "כמעט שם...",
];

function CommittingStage() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setI((p) => (p + 1) % COMMIT_MESSAGES.length);
    }, 2200);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="py-8 flex flex-col items-center gap-4">
      <div className="qf-spinner h-10 w-10 border-black/30 border-t-black" />
      <div key={i} className="font-bold text-black text-lg qf-fade-in">
        {COMMIT_MESSAGES[i]}
      </div>
      <div className="text-sm text-black/60 max-w-xs">
        זה יכול לקחת 20-60 שניות. אל תסגרו את הדף.
      </div>
    </div>
  );
}

function DoneStage({
  result,
  onGo,
}: {
  result: CommitResult;
  onGo: () => void;
}) {
  return (
    <>
      <div className="w-16 h-16 rounded-2xl bg-white border-2 border-black grid place-items-center shadow-[0_4px_0_#000]">
        <IcoCheck c="#34C759" s={30} />
      </div>

      <div>
        <h2 className="text-black font-black text-2xl md:text-3xl">
          <span className="bg-black text-[#F8CB1E] px-3 py-0.5 rounded-lg inline-block">
            הייבוא הושלם!
          </span>
        </h2>
        <p className="text-black/70 text-sm mt-2">
          {result.itemsImported} פריטים · {result.categoriesImported} קטגוריות · {result.imagesUploaded} תמונות
        </p>
      </div>

      <button
        type="button"
        onClick={onGo}
        className="w-full py-3.5 rounded-2xl bg-black hover:bg-black/90 text-[#F8CB1E] text-base font-black border-2 border-black shadow-[0_4px_0_#000] hover:shadow-[0_6px_0_#000] hover:-translate-y-0.5 active:translate-y-0 active:shadow-[0_2px_0_#000] transition inline-flex items-center justify-center gap-2"
      >
        לתפריט שלי
        <IcoArrowLeft c="currentColor" s={18} />
      </button>
    </>
  );
}

function ErrorStage({
  message,
  onRetry,
  onClose,
}: {
  message: string | null;
  onRetry: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="w-14 h-14 rounded-2xl bg-black border-2 border-black grid place-items-center shadow-[0_3px_0_#000]">
        <IcoClose c="#F8CB1E" s={24} />
      </div>
      <div>
        <h2 className="text-black font-black text-xl">משהו השתבש</h2>
        {message && <p className="text-black/70 text-sm mt-1">{message}</p>}
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onRetry}
          className="px-6 py-3 rounded-xl bg-black text-[#F8CB1E] font-bold text-sm border-2 border-black shadow-[0_3px_0_#000] transition"
        >
          נסה שוב
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-6 py-3 rounded-xl bg-white/70 text-black font-bold text-sm border-2 border-black shadow-[0_3px_0_#000] transition"
        >
          אחר כך
        </button>
      </div>
    </>
  );
}

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <div className="bg-white border-2 border-black rounded-2xl p-3 text-center shadow-[0_3px_0_#000]">
      <div className="text-2xl font-black text-black tnum">{value}</div>
      <div className="text-xs text-black/60 font-semibold mt-0.5">{label}</div>
    </div>
  );
}

// Lightweight celebratory confetti - spawns falling pieces via the Web
// Animations API (no library, no global keyframes). Self-cleans on unmount.
function Confetti() {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const host = ref.current;
    if (!host || typeof host.animate !== "function") return;
    const colors = ["#F8CB1E", "#34C759", "#000000", "#f9af72", "#2666c4", "#c2421f"];
    const w = host.clientWidth || 480;
    const h = host.clientHeight || 360;
    const anims: Animation[] = [];
    for (let n = 0; n < 90; n++) {
      const piece = document.createElement("div");
      const size = 6 + Math.random() * 8;
      piece.style.cssText =
        `position:absolute;top:-16px;left:${Math.random() * w}px;width:${size}px;` +
        `height:${size * 0.55}px;background:${colors[n % colors.length]};` +
        `border-radius:1px;will-change:transform,opacity;`;
      host.appendChild(piece);
      const driftX = (Math.random() * 2 - 1) * 120;
      const rot = (Math.random() * 2 - 1) * 900;
      anims.push(
        piece.animate(
          [
            { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
            {
              transform: `translate(${driftX}px, ${h * 0.72}px) rotate(${rot * 0.7}deg)`,
              opacity: 1,
              offset: 0.8,
            },
            { transform: `translate(${driftX * 1.2}px, ${h + 40}px) rotate(${rot}deg)`, opacity: 0 },
          ],
          {
            duration: 1900 + Math.random() * 1500,
            delay: Math.random() * 350,
            easing: "cubic-bezier(.18,.7,.4,1)",
            fill: "forwards",
          },
        ),
      );
    }
    return () => {
      anims.forEach((a) => a.cancel());
      host.replaceChildren();
    };
  }, []);
  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden z-30" />
  );
}
