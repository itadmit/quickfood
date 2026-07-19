// Cloud kitchen-ticket printing for HSPOS-family MQTT printers (HS-C830 etc.).
// The printer keeps an outbound MQTT connection to a broker and prints any
// raw ESC/POS bytes published to its device topic (self-test page → SubTopic,
// looks like "Prn2E0D0B...B1430CEB6062"). No LAN access or printer IP needed;
// the unit resumes queued jobs after a network drop and can fail over to its
// SIM. Verified live against a real unit on 2026-07-19.
//
// Hebrew: the firmware does its own RTL visual reordering, so text is sent in
// LOGICAL order encoded as CP862 (the unit's default codepage). Do NOT
// pre-reverse lines - that prints backwards.

import mqtt from "mqtt";
import type { ReceiptLine } from "@/lib/receipt-print";

export { resolvePrinterSettings, type CloudPrinterSettings } from "@/lib/printing/settings";

// ─── CP862 encoding ───────────────────────────────────────────

const HEBREW_BASE = 0x80; // א..ת map to 0x80..0x9A in CP862
const CHAR_MAP: Record<string, string> = {
  "₪": "",
  "×": "x",
  "־": "-",
  "׳": "'",
  "״": '"',
  "…": "...",
  "•": "*",
  "·": "-",
  " ": " ",
};

export function encodeCp862(text: string): number[] {
  const out: number[] = [];
  for (const ch of text.normalize("NFC")) {
    const code = ch.codePointAt(0)!;
    if (code === 0x200e || code === 0x200f) continue; // LRM/RLM
    const mapped = CHAR_MAP[ch];
    if (mapped !== undefined) {
      for (const m of mapped) out.push(m.codePointAt(0)!);
      continue;
    }
    if (code >= 0x05d0 && code <= 0x05ea) {
      out.push(HEBREW_BASE + (code - 0x05d0));
    } else if (code >= 0x20 && code <= 0x7e) {
      out.push(code);
    } else if (code === 0x0a) {
      out.push(0x0a);
    } else {
      out.push(0x3f); // '?'
    }
  }
  return out;
}

// ─── ESC/POS ticket builder ───────────────────────────────────

const ESC = 0x1b;
const GS = 0x1d;
const TICKET_COLS = 48; // 576 dots / Font A 12px

class TicketBuilder {
  private bytes: number[] = [ESC, 0x40]; // init

  align(a: "right" | "center" | "left"): this {
    this.bytes.push(ESC, 0x61, a === "left" ? 0 : a === "center" ? 1 : 2);
    return this;
  }

  bold(on: boolean): this {
    this.bytes.push(ESC, 0x45, on ? 1 : 0);
    return this;
  }

  size(double: boolean): this {
    this.bytes.push(GS, 0x21, double ? 0x11 : 0x00);
    return this;
  }

  line(text = ""): this {
    this.bytes.push(...encodeCp862(text), 0x0a);
    return this;
  }

  rule(): this {
    this.align("center");
    this.bytes.push(...Array.from({ length: TICKET_COLS }, () => 0x2d), 0x0a);
    return this;
  }

  cut(): this {
    for (let i = 0; i < 5; i++) this.bytes.push(0x0a);
    this.bytes.push(GS, 0x56, 0x42, 0x00); // partial cut with feed
    return this;
  }

  build(): Buffer {
    return Buffer.from(this.bytes);
  }
}

/** Render the shared receipt line model into an ESC/POS byte ticket. */
export function renderTicket(lines: ReceiptLine[]): Buffer {
  const t = new TicketBuilder();
  for (const l of lines) {
    switch (l.kind) {
      case "title":
        t.align("center").bold(true).size(true).line(l.text).size(false).bold(false);
        break;
      case "rule":
        t.rule();
        break;
      case "group":
        t.align("right").bold(true).line(l.text).bold(false);
        break;
      case "opt":
        t.align("right").line(`  ${l.text}`);
        break;
      case "text":
        t.align("right").line(l.text);
        break;
      case "row": {
        // Single right-aligned "label: value" line. The firmware's bidi pass
        // handles Hebrew-labels-with-numbers correctly (verified on-device);
        // two-column padding would get scrambled by that same pass.
        const text = l.left !== undefined ? `${l.right}: ${l.left}` : l.right;
        if (l.size === "total") {
          t.align("right").bold(true).size(true).line(text).size(false).bold(false);
        } else {
          t.align("right").line(text);
        }
        break;
      }
    }
  }
  return t.cut().build();
}

export function renderTestTicket(tenantName: string): Buffer {
  return renderTicket([
    { kind: "title", text: tenantName },
    { kind: "rule" },
    { kind: "text", text: "הדפסת בדיקה מקוויקפוד", size: "normal" },
    { kind: "text", text: "אם אתם רואים את הפתקית הזו - המדפסת מחוברת", size: "muted" },
    { kind: "rule" },
    { kind: "row", right: "סכום לדוגמה", left: "141", size: "total" },
  ]);
}

// ─── MQTT delivery ────────────────────────────────────────────

function brokerConfig() {
  return {
    url: process.env.PRINTER_MQTT_URL ?? "mqtt://47.106.112.155:1883",
    username: process.env.PRINTER_MQTT_USERNAME ?? "test",
    password: process.env.PRINTER_MQTT_PASSWORD ?? "test",
  };
}

/** Publish an ESC/POS payload to a printer's device topic. Throws on failure. */
export async function publishToPrinter(deviceTopic: string, payload: Buffer): Promise<void> {
  const { url, username, password } = brokerConfig();
  const client = await mqtt.connectAsync(url, {
    username,
    password,
    connectTimeout: 8_000,
    reconnectPeriod: 0,
  });
  try {
    await client.publishAsync(deviceTopic, payload, { qos: 1 });
  } finally {
    client.end(true);
  }
}
