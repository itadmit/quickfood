"use client";

import { useRef, useState } from "react";
import { IcoPlus } from "@/components/shared/Icons";
import { cn } from "@/lib/cn";

const ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_BYTES = 5_000_000; // 5MB

interface Props {
  type: "menu_item_image" | "logo" | "review_photo";
  value: string[]; // ordered list of public URLs; first is the primary
  onChange: (next: string[]) => void;
  multiple?: boolean;
  max?: number;
  className?: string;
}

interface UploadInitResponse {
  file_id: string;
  key: string;
  upload: { url: string; method: "PUT"; headers: Record<string, string> };
}

export function ImageUploader({
  type,
  value,
  onChange,
  multiple = true,
  max = 5,
  className,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string[]>([]); // local previews while uploading
  const [error, setError] = useState<string | null>(null);

  async function uploadOne(file: File): Promise<string | null> {
    if (file.size > MAX_BYTES) {
      setError(`קובץ ${file.name} גדול מ-5MB`);
      return null;
    }
    if (!ACCEPT.split(",").includes(file.type)) {
      setError(`סוג קובץ לא נתמך: ${file.type}`);
      return null;
    }

    // 1. init
    const initRes = await fetch("/api/v1/upload/init", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type,
        filename: file.name,
        mime_type: file.type,
        size_bytes: file.size,
      }),
    });
    if (!initRes.ok) {
      const e = await initRes.json().catch(() => ({}));
      setError(e?.error?.message ?? "init upload failed");
      return null;
    }
    const init = (await initRes.json()) as UploadInitResponse;

    // 2. PUT to R2
    const putRes = await fetch(init.upload.url, {
      method: init.upload.method,
      headers: init.upload.headers,
      body: file,
    });
    if (!putRes.ok) {
      setError("העלאה ל-R2 נכשלה");
      return null;
    }

    // 3. finalize
    const finRes = await fetch(
      `/api/v1/upload/finalize/${init.file_id}?key=${encodeURIComponent(init.key)}`,
      { method: "POST" },
    );
    if (!finRes.ok) {
      const e = await finRes.json().catch(() => ({}));
      setError(e?.error?.message ?? "finalize failed");
      return null;
    }
    const { url } = (await finRes.json()) as { url: string };
    return url;
  }

  async function onPick(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    const arr = Array.from(files).slice(0, max - value.length);
    const tempIds = arr.map(() => `pending:${crypto.randomUUID()}`);
    setUploading((prev) => [...prev, ...tempIds]);

    const results: string[] = [];
    for (let i = 0; i < arr.length; i++) {
      const url = await uploadOne(arr[i]);
      if (url) results.push(url);
      setUploading((prev) => prev.filter((id) => id !== tempIds[i]));
    }
    if (results.length > 0) {
      onChange([...value, ...results]);
    }
  }

  function remove(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  function makePrimary(idx: number) {
    if (idx === 0) return;
    const next = [value[idx], ...value.filter((_, i) => i !== idx)];
    onChange(next);
  }

  function move(idx: number, direction: -1 | 1) {
    const ni = idx + direction;
    if (ni < 0 || ni >= value.length) return;
    const next = [...value];
    [next[idx], next[ni]] = [next[ni], next[idx]];
    onChange(next);
  }

  const canAdd = value.length + uploading.length < max;

  return (
    <div className={cn("space-y-2", className)}>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple={multiple}
        className="hidden"
        onChange={(e) => onPick(e.target.files)}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {value.map((url, idx) => (
          <div
            key={url + idx}
            className="relative aspect-square rounded-xl overflow-hidden border border-qf-line-dash group"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt=""
              className="w-full h-full object-cover"
            />
            {idx === 0 && (
              <span className="absolute top-1.5 inset-s-1.5 bg-(--qf-primary) text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                ראשית
              </span>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition flex items-center justify-between gap-1 text-white text-[10px]">
              <div className="flex gap-0.5">
                <button
                  type="button"
                  onClick={() => move(idx, -1)}
                  disabled={idx === 0}
                  className="px-1.5 py-0.5 rounded bg-white/20 hover:bg-white/30 disabled:opacity-40"
                  aria-label="הזז ימינה"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => move(idx, 1)}
                  disabled={idx === value.length - 1}
                  className="px-1.5 py-0.5 rounded bg-white/20 hover:bg-white/30 disabled:opacity-40"
                  aria-label="הזז שמאלה"
                >
                  →
                </button>
              </div>
              <div className="flex gap-0.5">
                {idx !== 0 && (
                  <button
                    type="button"
                    onClick={() => makePrimary(idx)}
                    className="px-1.5 py-0.5 rounded bg-white/20 hover:bg-white/30"
                  >
                    ראשית
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  className="px-1.5 py-0.5 rounded bg-qf-tomato/80 hover:bg-qf-tomato"
                  aria-label="הסר"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        ))}
        {uploading.map((id) => (
          <div
            key={id}
            className="aspect-square rounded-xl border border-qf-line-dash bg-qf-line-soft animate-pulse grid place-items-center text-xs text-qf-mute"
          >
            מעלה...
          </div>
        ))}
        {canAdd && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="aspect-square rounded-xl border-2 border-dashed border-qf-line-dash hover:border-(--qf-primary) hover:bg-qf-green-soft/40 grid place-items-center text-qf-mute text-xs"
          >
            <div className="flex flex-col items-center gap-1">
              <IcoPlus c="#7c8a82" s={20} />
              <span>הוסף תמונה</span>
            </div>
          </button>
        )}
      </div>

      <div className="text-[11px] text-qf-mute">
        עד {max} תמונות · jpg/png/webp · עד 5MB · התמונה הראשונה היא הראשית בתצוגת המוצר
      </div>

      {error && (
        <div className="text-xs bg-qf-tomato-soft border border-qf-tomato/40 text-qf-tomato rounded-lg px-2 py-1.5">
          {error}
        </div>
      )}
    </div>
  );
}
