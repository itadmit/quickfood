"use client";

import { useRef, useState } from "react";
import { IcoPlus, IcoClose } from "@/components/shared/Icons";
import { cn } from "@/lib/cn";
import { convertImageToWebP } from "@/lib/image/convert-to-webp";

const ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_BYTES = 10_000_000;

/**
 * Compact single-image picker - used in the option-row context where there's
 * room for a thumbnail but not the full ImageUploader grid. Reuses the same
 * upload flow (POST /api/v1/upload/init → PUT R2 → POST finalize). 40×40 by
 * default, click to pick / re-pick, tiny X on hover to clear.
 */
export function MiniImagePicker({
  value,
  onChange,
  size = 40,
  className,
}: {
  value: string | null | undefined;
  onChange: (next: string | null) => void;
  size?: number;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);

  async function pick(original: File) {
    if (original.size > MAX_BYTES) {
      alert("הקובץ גדול מ-10MB");
      return;
    }
    if (!ACCEPT.split(",").includes(original.type)) {
      alert("סוג קובץ לא נתמך");
      return;
    }
    setBusy(true);
    setPct(0);
    try {
      // Convert + downscale in the browser before uploading so R2 holds
      // optimized WebP bytes. Falls back to the original on any failure.
      const file = await convertImageToWebP(original);

      const initRes = await fetch("/api/v1/upload/init", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "menu_item_image",
          filename: file.name,
          mime_type: file.type,
          size_bytes: file.size,
        }),
      });
      if (!initRes.ok) throw new Error("init failed");
      const init = (await initRes.json()) as {
        file_id: string;
        key: string;
        upload: { url: string; method: "PUT"; headers: Record<string, string> };
      };

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(init.upload.method, init.upload.url, true);
        for (const [k, v] of Object.entries(init.upload.headers)) {
          xhr.setRequestHeader(k, v);
        }
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setPct(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`R2 ${xhr.status}`)));
        xhr.onerror = () => reject(new Error("R2 network error"));
        xhr.send(file);
      });

      const finRes = await fetch(
        `/api/v1/upload/finalize/${init.file_id}?key=${encodeURIComponent(init.key)}`,
        { method: "POST" },
      );
      if (!finRes.ok) throw new Error("finalize failed");
      const { url } = (await finRes.json()) as { url: string };
      onChange(url);
    } catch (e) {
      console.error("MiniImagePicker upload failed", e);
      alert("העלאה נכשלה");
    } finally {
      setBusy(false);
      setPct(0);
    }
  }

  return (
    <div
      className={cn("relative group", className)}
      style={{ width: size, height: size }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) pick(f);
          e.target.value = "";
        }}
      />
      {value ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="w-full h-full rounded-lg overflow-hidden border border-qf-line-dash relative"
          aria-label="החלף תמונה"
          title="קליק להחלפת תמונה"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="w-full h-full object-cover" />
          {busy && (
            <div className="absolute inset-0 bg-black/40 grid place-items-center text-white text-[10px] font-bold">
              {pct}%
            </div>
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="w-full h-full rounded-lg border border-dashed border-qf-line-dash grid place-items-center hover:border-(--qf-primary) hover:bg-qf-line-soft/60 transition"
          aria-label="הוסף תמונה"
          title="הוסף תמונה"
        >
          {busy ? (
            <span className="text-[9px] font-bold text-qf-mute">{pct}%</span>
          ) : (
            <IcoPlus c="#9ca3a0" s={14} />
          )}
        </button>
      )}
      {value && !busy && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="absolute -top-1 -inset-e-1 w-5 h-5 rounded-full bg-qf-tomato text-white grid place-items-center shadow ring-2 ring-white/80"
          aria-label="הסר תמונה"
          title="הסר תמונה"
        >
          <IcoClose c="#fff" s={10} />
        </button>
      )}
    </div>
  );
}
