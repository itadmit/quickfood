// Receipt printing bridges for the merchant dashboard. All printers render
// the same line model; delivery differs per family:
//   star    - Star PassPRNT app, receives HTML over starpassprnt:// scheme
//   epson   - Epson TM Print Assistant app, receives ePOS-Print XML with a
//             1bpp raster image over tmprintassistant:// scheme
//   escpos  - generic Bluetooth ESC/POS printers via the RawBT Android app,
//             receives raw ESC/POS bytes (base64) over an intent: URL
//   airprint - the OS print dialog (window.print + print stylesheet)
// Epson/escpos print an IMAGE rather than text because Hebrew over raw
// printer codepages is unreliable; rasterizing client-side sidesteps it.

import { formatPrice, formatDateTime } from "@/lib/format";

export type ReceiptPrinterType = "airprint" | "star" | "epson" | "escpos";

export const RECEIPT_PRINTER_LABEL: Record<ReceiptPrinterType, string> = {
  airprint: "מדפסת רגילה (WiFi / AirPrint)",
  star: "Star Micronics",
  epson: "Epson TM",
  escpos: "מדפסת בלוטות' אחרת (אנדרואיד)",
};

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash: "מזומן",
  card: "כרטיס אשראי",
  apple_pay: "Apple Pay",
  google_pay: "Google Pay",
  bit: "ביט",
};

export interface ReceiptOrder {
  number: string;
  created_at: string;
  method: "delivery" | "pickup";
  total: number;
  subtotal: number;
  delivery_fee: number;
  service_fee: number;
  cutlery_count: number;
  cutlery_fee: number;
  tip: number;
  discount: number;
  payment_method: string;
  customer_notes: string | null;
  delivery_notes: string | null;
  customer: { name: string | null; phone: string | null } | null;
  delivery_address: {
    street: string;
    city: string;
    floor: string | null;
    apartment: string | null;
    notes: string | null;
  } | null;
  items: Array<{
    name: string;
    quantity: number;
    total_price: number;
    size: string | null;
    options: unknown;
    notes: string | null;
  }>;
}

// Groups option list entries by (name, half) and renders as
// "name (חצי א׳)" with " ×N" suffix when the same selection
// appears more than once.
export function formatSelectedOptions(options: unknown): string {
  if (!Array.isArray(options)) return "";
  const list = options as Array<{ name?: string; half?: string }>;
  const groups = new Map<string, { name: string; half?: string; count: number }>();
  for (const o of list) {
    if (!o?.name) continue;
    const key = `${o.name}|${o.half ?? ""}`;
    const existing = groups.get(key);
    if (existing) existing.count += 1;
    else groups.set(key, { name: o.name, half: o.half, count: 1 });
  }
  return Array.from(groups.values())
    .map((g) => {
      const base =
        g.half === "left"
          ? `${g.name} (חצי א׳)`
          : g.half === "right"
            ? `${g.name} (חצי ב׳)`
            : g.name;
      return g.count > 1 ? `${base} ×${g.count}` : base;
    })
    .join(" · ");
}

// ─── Shared line model ────────────────────────────────────────

type ReceiptLine =
  | { kind: "title"; text: string }
  | { kind: "row"; right: string; left?: string; size: "normal" | "muted" | "total" }
  | { kind: "text"; text: string; size: "normal" | "muted" }
  | { kind: "rule" };

function buildReceiptLines(order: ReceiptOrder): ReceiptLine[] {
  const lines: ReceiptLine[] = [];
  const addr = order.delivery_address;

  lines.push({ kind: "title", text: `#${order.number}` });
  lines.push({
    kind: "row",
    right: formatDateTime(order.created_at),
    left: order.method === "delivery" ? "משלוח" : "איסוף",
    size: "muted",
  });
  lines.push({ kind: "rule" });
  lines.push({ kind: "text", text: order.customer?.name || "אורח", size: "normal" });
  if (order.customer?.phone) {
    lines.push({ kind: "text", text: order.customer.phone, size: "muted" });
  }
  if (order.method === "delivery") {
    if (addr) {
      lines.push({
        kind: "text",
        text:
          `${addr.street}, ${addr.city}` +
          (addr.floor ? ` · קומה ${addr.floor}` : "") +
          (addr.apartment ? ` · דירה ${addr.apartment}` : ""),
        size: "muted",
      });
      if (addr.notes) lines.push({ kind: "text", text: addr.notes, size: "muted" });
    } else if (order.delivery_notes) {
      lines.push({ kind: "text", text: order.delivery_notes, size: "muted" });
    }
  }
  lines.push({ kind: "rule" });

  for (const it of order.items) {
    lines.push({
      kind: "row",
      right: `${it.quantity}× ${it.name}${it.size ? ` · ${it.size}` : ""}`,
      left: formatPrice(it.total_price),
      size: "normal",
    });
    const opts = formatSelectedOptions(it.options);
    if (opts) lines.push({ kind: "text", text: opts, size: "muted" });
    if (it.notes) lines.push({ kind: "text", text: `הערה: ${it.notes}`, size: "muted" });
  }

  lines.push({ kind: "rule" });
  lines.push({ kind: "row", right: "סכום ביניים", left: formatPrice(order.subtotal), size: "muted" });
  if (order.method === "delivery" && order.delivery_fee > 0) {
    lines.push({ kind: "row", right: "דמי משלוח", left: formatPrice(order.delivery_fee), size: "muted" });
  }
  if (order.service_fee > 0) {
    lines.push({ kind: "row", right: "דמי שירות", left: formatPrice(order.service_fee), size: "muted" });
  }
  if (order.cutlery_count > 0) {
    lines.push({
      kind: "row",
      right: `סכו"ם × ${order.cutlery_count}`,
      left: order.cutlery_fee > 0 ? formatPrice(order.cutlery_fee) : "חינם",
      size: "muted",
    });
  }
  if (order.tip > 0) {
    lines.push({ kind: "row", right: "טיפ לשליח", left: formatPrice(order.tip), size: "muted" });
  }
  if (order.discount > 0) {
    lines.push({ kind: "row", right: "הנחה", left: `-${formatPrice(order.discount)}`, size: "muted" });
  }
  lines.push({ kind: "rule" });
  lines.push({ kind: "row", right: "סה״כ", left: formatPrice(order.total), size: "total" });
  lines.push({
    kind: "row",
    right: "תשלום",
    left: PAYMENT_METHOD_LABEL[order.payment_method] ?? order.payment_method,
    size: "muted",
  });
  if (order.customer_notes) {
    lines.push({ kind: "rule" });
    lines.push({ kind: "text", text: order.customer_notes, size: "muted" });
  }
  return lines;
}

// ─── HTML rendering (Star PassPRNT renders HTML itself) ──────

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function buildReceiptHtml(order: ReceiptOrder): string {
  const body = buildReceiptLines(order)
    .map((l) => {
      switch (l.kind) {
        case "title":
          return `<h1>${esc(l.text)}</h1>`;
        case "rule":
          return `<div class="rule"></div>`;
        case "text":
          return `<div class="${l.size === "muted" ? "muted" : "row"}">${esc(l.text)}</div>`;
        case "row":
          return `<div class="row ${l.size === "total" ? "total" : l.size === "muted" ? "muted" : ""}"><span>${esc(
            l.right,
          )}</span>${l.left !== undefined ? `<span>${esc(l.left)}</span>` : ""}</div>`;
      }
    })
    .join("\n");

  return `<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="utf-8"><style>
body{margin:0;padding:8px 4px;font-family:-apple-system,sans-serif;color:#000;width:568px}
h1{font-size:44px;margin:0 0 4px;text-align:center}
.row{display:flex;justify-content:space-between;gap:12px;font-size:27px;line-height:1.35}
.row span:first-child{word-break:break-word}
.row span:last-child{white-space:nowrap}
.muted{font-size:24px;line-height:1.35}
.muted span{font-size:24px}
.rule{border-top:3px dashed #000;margin:10px 0}
.total{font-size:36px;font-weight:bold}
.total span{font-size:36px}
</style></head><body>
${body}
</body></html>`;
}

// ─── Canvas rendering (Epson / RawBT print a raster image) ───

const W = 576;
const MARGIN = 6;

const FONTS = {
  title: "bold 44px -apple-system, sans-serif",
  normal: "27px -apple-system, sans-serif",
  muted: "24px -apple-system, sans-serif",
  total: "bold 36px -apple-system, sans-serif",
};
const LINE_H = { title: 56, normal: 38, muted: 33, total: 48 };

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const out: string[] = [];
  let cur = words[0];
  for (let i = 1; i < words.length; i++) {
    const candidate = `${cur} ${words[i]}`;
    if (ctx.measureText(candidate).width <= maxWidth) cur = candidate;
    else {
      out.push(cur);
      cur = words[i];
    }
  }
  out.push(cur);
  return out;
}

function layoutReceipt(
  ctx: CanvasRenderingContext2D,
  lines: ReceiptLine[],
  draw: boolean,
): number {
  ctx.direction = "rtl";
  ctx.textBaseline = "top";
  if (draw) ctx.fillStyle = "#000";
  let y = MARGIN + 4;

  for (const l of lines) {
    if (l.kind === "rule") {
      if (draw) {
        ctx.save();
        ctx.setLineDash([12, 10]);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(MARGIN, y + 8);
        ctx.lineTo(W - MARGIN, y + 8);
        ctx.stroke();
        ctx.restore();
      }
      y += 22;
      continue;
    }
    if (l.kind === "title") {
      ctx.font = FONTS.title;
      if (draw) {
        ctx.textAlign = "center";
        ctx.fillText(l.text, W / 2, y);
      }
      y += LINE_H.title;
      continue;
    }
    if (l.kind === "text") {
      ctx.font = l.size === "muted" ? FONTS.muted : FONTS.normal;
      const lh = l.size === "muted" ? LINE_H.muted : LINE_H.normal;
      for (const part of wrapText(ctx, l.text, W - MARGIN * 2)) {
        if (draw) {
          ctx.textAlign = "right";
          ctx.fillText(part, W - MARGIN, y);
        }
        y += lh;
      }
      continue;
    }
    // row
    const font = l.size === "total" ? FONTS.total : l.size === "muted" ? FONTS.muted : FONTS.normal;
    const lh = l.size === "total" ? LINE_H.total : l.size === "muted" ? LINE_H.muted : LINE_H.normal;
    ctx.font = font;
    const leftWidth = l.left !== undefined ? ctx.measureText(l.left).width : 0;
    const rightMax = W - MARGIN * 2 - (leftWidth ? leftWidth + 18 : 0);
    const parts = wrapText(ctx, l.right, rightMax);
    parts.forEach((part, i) => {
      if (draw) {
        ctx.textAlign = "right";
        ctx.fillText(part, W - MARGIN, y);
        if (i === 0 && l.left !== undefined) {
          ctx.textAlign = "left";
          ctx.fillText(l.left, MARGIN, y);
        }
      }
      y += lh;
    });
  }
  return y + MARGIN + 10;
}

export function renderReceiptCanvas(order: ReceiptOrder): HTMLCanvasElement {
  const lines = buildReceiptLines(order);
  const measure = document.createElement("canvas");
  measure.width = W;
  measure.height = 8;
  const height = Math.ceil(layoutReceipt(measure.getContext("2d")!, lines, false) / 8) * 8;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, height);
  layoutReceipt(ctx, lines, true);
  return canvas;
}

// 1bpp, MSB-first, row-major. bit=1 means a black dot.
function canvasTo1bpp(canvas: HTMLCanvasElement): Uint8Array {
  const ctx = canvas.getContext("2d")!;
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const widthBytes = canvas.width / 8;
  const out = new Uint8Array(widthBytes * canvas.height);
  for (let yPx = 0; yPx < canvas.height; yPx++) {
    for (let xPx = 0; xPx < canvas.width; xPx++) {
      const i = (yPx * canvas.width + xPx) * 4;
      const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      if (data[i + 3] > 128 && lum < 160) {
        out[yPx * widthBytes + (xPx >> 3)] |= 0x80 >> (xPx & 7);
      }
    }
  }
  return out;
}

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

// ─── App-bridge navigation with not-installed fallback ───────

function navigateToApp(url: string, onUnhandled?: () => void): void {
  if (onUnhandled) {
    const onLeave = () => {
      if (document.visibilityState !== "hidden") return;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onLeave);
    };
    const timer = window.setTimeout(() => {
      document.removeEventListener("visibilitychange", onLeave);
      onUnhandled();
    }, 2500);
    document.addEventListener("visibilitychange", onLeave);
  }
  window.location.href = url;
}

// ─── Star (PassPRNT) ──────────────────────────────────────────

export function openPassPrnt(html: string, onUnhandled?: () => void): void {
  const back = `${window.location.origin}${window.location.pathname}`;
  const url =
    `starpassprnt://v1/print/nopreview?back=${encodeURIComponent(back)}` +
    `&size=${W}` +
    `&html=${encodeURIComponent(html)}`;
  navigateToApp(url, onUnhandled);
}

export function consumePassPrntResult(): { ok: boolean; message: string } | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const code = params.get("passprnt_code");
  if (code === null) return null;
  const message = params.get("passprnt_message") ?? "";

  params.delete("passprnt_code");
  params.delete("passprnt_message");
  const rest = params.toString();
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${rest ? `?${rest}` : ""}${window.location.hash}`,
  );

  return { ok: code === "0", message };
}

// ─── Epson (TM Print Assistant) ───────────────────────────────

function printEpson(order: ReceiptOrder, onUnhandled?: () => void): void {
  const canvas = renderReceiptCanvas(order);
  const raster = toBase64(canvasTo1bpp(canvas));
  const xml =
    `<epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print">` +
    `<image width="${W}" height="${canvas.height}" color="color_1" mode="mono">${raster}</image>` +
    `<feed line="3"/><cut type="feed"/></epos-print>`;
  const back = `${window.location.origin}${window.location.pathname}`;
  const url =
    `tmprintassistant://tmprintassistant.epson.com/print` +
    `?success=${encodeURIComponent(back)}&ver=1&data-type=eposprintxml&reselect=yes` +
    `&data=${encodeURIComponent(xml)}`;
  navigateToApp(url, onUnhandled);
}

// ─── Generic ESC/POS via RawBT (Android only) ─────────────────

function printRawBt(order: ReceiptOrder, onUnhandled?: () => void): void {
  const canvas = renderReceiptCanvas(order);
  const raster = canvasTo1bpp(canvas);
  const widthBytes = W / 8;

  const chunks: number[] = [0x1b, 0x40]; // ESC @ init
  // GS v 0 in bands - some firmwares cap a single raster block's height
  const BAND = 256;
  for (let row = 0; row < canvas.height; row += BAND) {
    const rows = Math.min(BAND, canvas.height - row);
    chunks.push(0x1d, 0x76, 0x30, 0x00, widthBytes & 0xff, widthBytes >> 8, rows & 0xff, rows >> 8);
    for (let i = row * widthBytes; i < (row + rows) * widthBytes; i++) chunks.push(raster[i]);
  }
  chunks.push(0x0a, 0x0a, 0x0a, 0x0a); // feed
  chunks.push(0x1d, 0x56, 0x42, 0x00); // GS V - partial cut (ignored if no cutter)

  const b64 = toBase64(new Uint8Array(chunks));
  const url = `intent:base64,${b64}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`;
  navigateToApp(url, onUnhandled);
}

// ─── Dispatch ─────────────────────────────────────────────────

export function printReceipt(
  order: ReceiptOrder,
  printer: ReceiptPrinterType,
  onUnhandled?: () => void,
): void {
  switch (printer) {
    case "star":
      openPassPrnt(buildReceiptHtml(order), onUnhandled);
      break;
    case "epson":
      printEpson(order, onUnhandled);
      break;
    case "escpos":
      printRawBt(order, onUnhandled);
      break;
    default:
      window.print();
  }
}
