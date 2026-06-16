"use client";

import { useRef, useState } from "react";
import { IcoPlus, IcoClose, IcoArrowLeft, IcoArrowRight } from "@/components/shared/Icons";
import { cn } from "@/lib/cn";
import { convertImageToWebP } from "@/lib/image/convert-to-webp";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/shared/Modal";

const ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_BYTES = 10_000_000; // 10MB (pre-compression; we re-encode to WebP client-side)

interface Props {
  type: "menu_item_image" | "logo" | "cover_image" | "review_photo" | "campaign_image";
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

/** Per-file upload-in-progress state. */
interface PendingUpload {
  id: string;
  name: string;
  progress: number; // 0-100
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
  const [uploading, setUploading] = useState<PendingUpload[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Index pending a delete-confirmation, plus the in-flight + error state of
  // the actual R2 deletion.
  const [confirmIdx, setConfirmIdx] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function updateProgress(id: string, progress: number) {
    setUploading((prev) =>
      prev.map((p) => (p.id === id ? { ...p, progress } : p)),
    );
  }

  function removePending(id: string) {
    setUploading((prev) => prev.filter((p) => p.id !== id));
  }

  /**
   * PUT to R2 via XHR so we can surface real upload progress. fetch() doesn't
   * expose `upload.onprogress`; XHR does.
   */
  function putWithProgress(
    init: UploadInitResponse,
    file: File,
    onProgress: (pct: number) => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(init.upload.method, init.upload.url, true);
      for (const [k, v] of Object.entries(init.upload.headers)) {
        xhr.setRequestHeader(k, v);
      }
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`R2 status ${xhr.status}`));
      };
      xhr.onerror = () => reject(new Error("R2 network error"));
      xhr.onabort = () => reject(new Error("upload aborted"));
      xhr.send(file);
    });
  }

  async function uploadOne(
    original: File,
    id: string,
  ): Promise<string | null> {
    if (original.size > MAX_BYTES) {
      setError(`קובץ ${original.name} גדול מ-10MB`);
      return null;
    }
    if (!ACCEPT.split(",").includes(original.type)) {
      setError(`סוג קובץ לא נתמך: ${original.type}`);
      return null;
    }

    // Convert + downscale in the browser before uploading so R2 holds
    // optimized WebP bytes (typically 30-50% of the original JPEG/PNG).
    // Falls back to the original on any failure.
    const file = await convertImageToWebP(original);

    // 1) init - get a presigned URL
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

    // 2) PUT to R2 with progress
    try {
      await putWithProgress(init, file, (pct) => updateProgress(id, pct));
    } catch (e) {
      setError(e instanceof Error ? e.message : "העלאה ל-R2 נכשלה");
      return null;
    }

    // 3) finalize - confirm + get public URL
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

    // Create pending entries up-front so the placeholders appear immediately.
    const pendings: PendingUpload[] = arr.map((f) => ({
      id: `pending:${crypto.randomUUID()}`,
      name: f.name,
      progress: 0,
    }));
    setUploading((prev) => [...prev, ...pendings]);

    const results: string[] = [];
    for (let i = 0; i < arr.length; i++) {
      const id = pendings[i].id;
      try {
        const url = await uploadOne(arr[i], id);
        if (url) results.push(url);
      } catch (e) {
        setError(e instanceof Error ? e.message : "העלאה נכשלה");
      } finally {
        // Always clear the pending tile so the UI never gets stuck at 100%.
        removePending(id);
      }
    }

    if (results.length > 0) {
      onChange([...value, ...results]);
    }
  }

  async function confirmDelete() {
    if (confirmIdx == null) return;
    const url = value[confirmIdx];
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/v1/upload/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        setDeleteError(e?.error?.message ?? "מחיקת התמונה נכשלה");
        setDeleting(false);
        return;
      }
    } catch {
      setDeleteError("מחיקת התמונה נכשלה - בדוק חיבור ונסה שוב");
      setDeleting(false);
      return;
    }
    onChange(value.filter((_, i) => i !== confirmIdx));
    setDeleting(false);
    setConfirmIdx(null);
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
            className="relative aspect-square rounded-xl overflow-hidden border-2 border-black shadow-[0_2px_0_#000] group"
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
            {/* Always-visible red delete badge - removes from the product AND R2. */}
            <button
              type="button"
              onClick={() => {
                setDeleteError(null);
                setConfirmIdx(idx);
              }}
              className="absolute top-1.5 inset-e-1.5 w-6 h-6 rounded-full grid place-items-center bg-qf-tomato text-white shadow-md ring-2 ring-white/80 hover:scale-110 transition"
              aria-label="מחק תמונה"
              title="מחק תמונה"
            >
              <IcoClose c="#fff" s={12} />
            </button>
            <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition flex items-center justify-between gap-1 text-white text-[10px]">
              <div className="flex gap-0.5">
                <button
                  type="button"
                  onClick={() => move(idx, -1)}
                  disabled={idx === 0}
                  className="w-6 h-6 rounded grid place-items-center bg-white/20 hover:bg-white/30 disabled:opacity-40"
                  aria-label="הזז ימינה"
                >
                  <IcoArrowRight c="#fff" s={12} />
                </button>
                <button
                  type="button"
                  onClick={() => move(idx, 1)}
                  disabled={idx === value.length - 1}
                  className="w-6 h-6 rounded grid place-items-center bg-white/20 hover:bg-white/30 disabled:opacity-40"
                  aria-label="הזז שמאלה"
                >
                  <IcoArrowLeft c="#fff" s={12} />
                </button>
              </div>
              {idx !== 0 && (
                <button
                  type="button"
                  onClick={() => makePrimary(idx)}
                  className="px-1.5 py-0.5 rounded bg-white/20 hover:bg-white/30"
                >
                  ראשית
                </button>
              )}
            </div>
          </div>
        ))}

        {uploading.map((p) => (
          <UploadingTile key={p.id} progress={p.progress} name={p.name} />
        ))}

        {canAdd && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="aspect-square rounded-xl border-2 border-dashed border-black/40 hover:border-black hover:bg-qf-green-soft/40 grid place-items-center text-qf-mute text-xs transition-colors"
          >
            <div className="flex flex-col items-center gap-1">
              <IcoPlus c="#7c8a82" s={20} />
              <span>הוסף תמונה</span>
            </div>
          </button>
        )}
      </div>

      <div className="text-[11px] text-qf-mute">
        עד {max} תמונות · jpg/png/webp · עד 10MB · התמונה הראשונה היא הראשית בתצוגת המוצר
      </div>

      {error && (
        <div className="text-xs bg-qf-tomato-soft border border-qf-tomato/40 text-qf-tomato rounded-lg px-2 py-1.5">
          {error}
        </div>
      )}

      <Modal
        open={confirmIdx !== null}
        onClose={() => {
          if (!deleting) setConfirmIdx(null);
        }}
        size="sm"
        ariaLabel="מחיקת תמונה"
      >
        <ModalHeader title="למחוק את התמונה?" />
        <ModalBody>
          <div className="flex gap-3">
            {confirmIdx !== null && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={value[confirmIdx]}
                alt=""
                className="w-16 h-16 rounded-xl object-cover border border-qf-line-dash shrink-0"
              />
            )}
            <p className="text-sm text-qf-ink2 leading-relaxed">
              התמונה תימחק לחלוטין מהאחסון (R2) ולא ניתן יהיה לשחזר אותה.
              להמשיך?
            </p>
          </div>
          {deleteError && (
            <div className="mt-3 text-xs bg-qf-tomato-soft border border-qf-tomato/40 text-qf-tomato rounded-lg px-2 py-1.5">
              {deleteError}
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <button
            type="button"
            onClick={() => setConfirmIdx(null)}
            disabled={deleting}
            className="px-4 py-2 rounded-xl text-sm font-medium text-qf-ink2 hover:bg-qf-line-soft disabled:opacity-50"
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={confirmDelete}
            disabled={deleting}
            className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-qf-tomato hover:opacity-90 disabled:opacity-50"
          >
            {deleting ? "מוחק..." : "מחק לצמיתות"}
          </button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

/**
 * Placeholder tile shown while an upload is in flight. Renders a circular
 * progress ring sweeping from 0→100% with the live percentage in the middle.
 * The very last bit (post-upload "finalize" call) is shown as 100% even though
 * the row hasn't been removed yet - keeps the UI calm.
 */
function UploadingTile({ progress, name }: { progress: number; name: string }) {
  // SVG ring math
  const SIZE = 56;
  const STROKE = 5;
  const radius = (SIZE - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, progress));
  const dashOffset = circumference * (1 - pct / 100);

  return (
    <div
      className="aspect-square rounded-xl border-2 border-black shadow-[0_2px_0_#000] bg-qf-line-soft/60 grid place-items-center"
      role="status"
      aria-label={`מעלה ${name}, ${pct} אחוזים`}
    >
      <div className="flex flex-col items-center gap-2">
        <div className="relative" style={{ width: SIZE, height: SIZE }}>
          <svg width={SIZE} height={SIZE} className="-rotate-90">
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={radius}
              stroke="rgba(0,0,0,0.08)"
              strokeWidth={STROKE}
              fill="none"
            />
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={radius}
              stroke="var(--qf-primary)"
              strokeWidth={STROKE}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              style={{ transition: "stroke-dashoffset 120ms linear" }}
            />
          </svg>
          <div
            className="absolute inset-0 grid place-items-center text-[11px] font-semibold text-qf-ink2 tnum"
            aria-hidden
          >
            {pct}%
          </div>
        </div>
        <div className="text-[10px] text-qf-mute max-w-[80%] truncate" title={name}>
          {name}
        </div>
      </div>
    </div>
  );
}
