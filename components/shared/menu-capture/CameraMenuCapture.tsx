"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Camera,
  Image as GalleryIcon,
  RotateCcw,
  Check,
  X,
  Wand2,
} from "lucide-react";

// Largest dimension we export. Keeps the upload well under the 15MB importer
// cap and the Gemini call fast, without throwing away legible detail.
const MAX_OUT = 2200;
const OUT_QUALITY = 0.9;

type Rect = { x: number; y: number; w: number; h: number };
type Handle = "move" | "nw" | "ne" | "sw" | "se";

/**
 * Camera-first menu capture. Shoots a live photo (rear camera), lets the
 * merchant crop to just the menu and apply a light readability boost, then
 * hands back a single JPEG File. Gallery import is always available as a
 * fallback (and the only path when there's no camera / permission denied).
 */
export function CameraMenuCapture({
  onCapture,
  onClose,
  enableCrop = true,
  aspect,
  label = "צילום",
}: {
  onCapture: (file: File) => void;
  onClose: () => void;
  // Cropping is only useful for a single dish photo. A full menu page is shot
  // edge-to-edge, so the menu-document capture passes enableCrop={false}.
  enableCrop?: boolean;
  // Locks the crop box to this width/height ratio (e.g. 1 = square dish photo).
  aspect?: number;
  label?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<"camera" | "crop">("camera");
  const [camError, setCamError] = useState<string | null>(null);
  const [srcUrl, setSrcUrl] = useState<string | null>(null);
  const [enhance, setEnhance] = useState(true);
  const [crop, setCrop] = useState<Rect | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const dragRef = useRef<{ handle: Handle; sx: number; sy: number; rect: Rect } | null>(null);

  useEffect(() => setMounted(true), []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    setCamError(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCamError("nodev");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 2400 }, height: { ideal: 2400 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch {
      setCamError("denied");
    }
  }, []);

  useEffect(() => {
    if (phase === "camera") void startCamera();
    return () => stopCamera();
  }, [phase, startCamera, stopCamera]);

  useEffect(() => {
    return () => {
      if (srcUrl) URL.revokeObjectURL(srcUrl);
    };
  }, [srcUrl]);

  function loadImage(url: string) {
    stopCamera();
    setSrcUrl(url);
    setCrop(null);
    setPhase("crop");
  }

  function capture() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (blob) loadImage(URL.createObjectURL(blob));
      },
      "image/jpeg",
      0.95,
    );
  }

  function onGallery(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    loadImage(URL.createObjectURL(file));
  }

  // Seed the crop box once the image lays out. With an aspect lock (dish
  // photo) we center a box of that ratio; otherwise ~92% of the frame.
  function onImgLoad() {
    if (!enableCrop) return;
    const img = imgRef.current;
    if (!img) return;
    const w = img.clientWidth;
    const h = img.clientHeight;
    if (aspect) {
      let bw = w * 0.86;
      let bh = bw / aspect;
      if (bh > h * 0.86) {
        bh = h * 0.86;
        bw = bh * aspect;
      }
      setCrop({ x: (w - bw) / 2, y: (h - bh) / 2, w: bw, h: bh });
    } else {
      const m = 0.04;
      setCrop({ x: w * m, y: h * m, w: w * (1 - 2 * m), h: h * (1 - 2 * m) });
    }
  }

  function clampRect(r: Rect): Rect {
    const img = imgRef.current;
    if (!img) return r;
    const maxW = img.clientWidth;
    const maxH = img.clientHeight;
    const min = 40;
    let { x, y, w, h } = r;
    w = Math.max(min, Math.min(w, maxW));
    h = Math.max(min, Math.min(h, maxH));
    x = Math.max(0, Math.min(x, maxW - w));
    y = Math.max(0, Math.min(y, maxH - h));
    return { x, y, w, h };
  }

  function onHandleDown(handle: Handle, e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!crop) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = { handle, sx: e.clientX, sy: e.clientY, rect: crop };
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    const r = { ...d.rect };
    if (d.handle === "move") {
      r.x += dx;
      r.y += dy;
    } else {
      if (d.handle === "nw" || d.handle === "sw") {
        r.x += dx;
        r.w -= dx;
      }
      if (d.handle === "ne" || d.handle === "se") {
        r.w += dx;
      }
      if (d.handle === "nw" || d.handle === "ne") {
        r.y += dy;
        r.h -= dy;
      }
      if (d.handle === "sw" || d.handle === "se") {
        r.h += dy;
      }
      if (aspect) r.h = r.w / aspect;
    }
    setCrop(clampRect(r));
  }

  function onPointerUp() {
    dragRef.current = null;
  }

  function confirm() {
    const img = imgRef.current;
    if (!img) return;
    // Full frame when cropping is off (menu document); cropped region otherwise.
    const useCrop = enableCrop && crop;
    const scaleX = img.naturalWidth / img.clientWidth;
    const scaleY = img.naturalHeight / img.clientHeight;
    const cx = useCrop ? crop.x * scaleX : 0;
    const cy = useCrop ? crop.y * scaleY : 0;
    const cw = useCrop ? crop.w * scaleX : img.naturalWidth;
    const ch = useCrop ? crop.h * scaleY : img.naturalHeight;
    let tw = cw;
    let th = ch;
    if (Math.max(tw, th) > MAX_OUT) {
      const k = MAX_OUT / Math.max(tw, th);
      tw = Math.round(tw * k);
      th = Math.round(th * k);
    }
    const out = document.createElement("canvas");
    out.width = Math.max(1, Math.round(tw));
    out.height = Math.max(1, Math.round(th));
    const ctx = out.getContext("2d");
    if (!ctx) return;
    if (enhance) ctx.filter = "contrast(1.18) brightness(1.06) saturate(1.04)";
    ctx.drawImage(img, cx, cy, cw, ch, 0, 0, out.width, out.height);
    out.toBlob(
      (blob) => {
        if (!blob) return;
        onCapture(new File([blob], "menu-photo.jpg", { type: "image/jpeg" }));
      },
      "image/jpeg",
      OUT_QUALITY,
    );
  }

  function retake() {
    if (srcUrl) URL.revokeObjectURL(srcUrl);
    setSrcUrl(null);
    setCrop(null);
    setPhase("camera");
  }

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] bg-black/95 flex flex-col text-white">
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <span className="text-sm font-bold">
          {phase === "camera" ? label : enableCrop ? "חיתוך התמונה" : "סקירה"}
        </span>
        <button
          type="button"
          onClick={() => {
            stopCamera();
            onClose();
          }}
          aria-label="סגור"
          className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 grid place-items-center"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center px-3 overflow-hidden">
        {phase === "camera" ? (
          camError ? (
            <div className="text-center space-y-4 max-w-xs">
              <p className="text-sm text-white/80 leading-relaxed">
                {camError === "denied"
                  ? "אין גישה למצלמה. אפשרו גישה בדפדפן, או בחרו תמונה מהגלריה."
                  : "אין מצלמה זמינה במכשיר. בחרו תמונה מהגלריה."}
              </p>
              <GalleryButton onChange={onGallery} dark />
            </div>
          ) : (
            <video
              ref={videoRef}
              playsInline
              muted
              className="max-h-full max-w-full rounded-2xl"
            />
          )
        ) : (
          srcUrl && (
            <div
              ref={wrapRef}
              className="relative inline-block touch-none select-none"
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imgRef}
                src={srcUrl}
                alt="תפריט"
                onLoad={onImgLoad}
                draggable={false}
                className="block max-w-full max-h-[62vh] object-contain rounded-xl"
                style={enhance ? { filter: "contrast(1.18) brightness(1.06) saturate(1.04)" } : undefined}
              />
              {enableCrop && crop && (
                <div
                  className="absolute border-2 border-[#F8CB1E] shadow-[0_0_0_2000px_rgba(0,0,0,0.5)]"
                  style={{ left: crop.x, top: crop.y, width: crop.w, height: crop.h }}
                  onPointerDown={(e) => onHandleDown("move", e)}
                >
                  {(["nw", "ne", "sw", "se"] as Handle[]).map((h) => (
                    <span
                      key={h}
                      onPointerDown={(e) => onHandleDown(h, e)}
                      className="absolute w-6 h-6 bg-[#F8CB1E] border-2 border-black rounded-full"
                      style={{
                        left: h.includes("w") ? -12 : undefined,
                        right: h.includes("e") ? -12 : undefined,
                        top: h.includes("n") ? -12 : undefined,
                        bottom: h.includes("s") ? -12 : undefined,
                        cursor: `${h}-resize`,
                        touchAction: "none",
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        )}
      </div>

      <div className="shrink-0 px-4 py-4 space-y-3">
        {phase === "crop" && (
          <button
            type="button"
            onClick={() => setEnhance((v) => !v)}
            className={`mx-auto flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-bold border-2 transition ${
              enhance
                ? "bg-[#F8CB1E] text-black border-[#F8CB1E]"
                : "bg-transparent text-white/80 border-white/30"
            }`}
          >
            <Wand2 size={15} />
            שיפור קריאות
          </button>
        )}

        {phase === "camera" && !camError ? (
          <div className="flex items-center justify-center gap-8">
            <GalleryButton onChange={onGallery} dark iconOnly />
            <button
              type="button"
              onClick={capture}
              aria-label="צלם"
              className="w-[72px] h-[72px] rounded-full bg-white grid place-items-center active:scale-95 transition"
            >
              <span className="w-14 h-14 rounded-full border-4 border-black grid place-items-center text-black">
                <Camera size={24} />
              </span>
            </button>
            <span className="w-11" aria-hidden />
          </div>
        ) : phase === "crop" ? (
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={retake}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-bold"
            >
              <RotateCcw size={15} />
              צילום מחדש
            </button>
            <button
              type="button"
              onClick={confirm}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#F8CB1E] text-black text-sm font-black border-2 border-black"
            >
              <Check size={16} />
              אישור והמשך
            </button>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

function GalleryButton({
  onChange,
  dark,
  iconOnly,
}: {
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  dark?: boolean;
  iconOnly?: boolean;
}) {
  return (
    <label
      className={
        iconOnly
          ? "w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 grid place-items-center cursor-pointer"
          : `inline-flex items-center gap-2 px-4 py-2.5 rounded-xl cursor-pointer text-sm font-bold border-2 ${
              dark ? "bg-white/10 hover:bg-white/20 text-white border-white/20" : "bg-white text-black border-black"
            }`
      }
    >
      <GalleryIcon size={iconOnly ? 20 : 16} />
      {!iconOnly && "בחירה מהגלריה"}
      <input type="file" accept="image/*" onChange={onChange} className="hidden" />
    </label>
  );
}
