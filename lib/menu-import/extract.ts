import Anthropic from "@anthropic-ai/sdk";
import type { ExtractedMenu } from "./types";

export const MENU_IMPORT_MODEL = process.env.MENU_IMPORT_MODEL || "claude-haiku-4-5";

export class MenuExtractError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

// Strict JSON-schema for structured outputs: every object sets
// additionalProperties:false and lists all its keys as required, so Claude
// always returns valid JSON in our exact shape - no markdown fences, no prose.
const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    categories: {
      type: "array",
      description: "כל שמות הקטגוריות בתפריט, לפי הסדר שבו הופיעו",
      items: { type: "string" },
    },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string", description: "שם המנה" },
          description: { type: "string", description: "תיאור המנה אם קיים, אחרת מחרוזת ריקה" },
          price: { type: "number", description: "מחיר המנה בשקלים שלמים (מספר). אם אין מחיר, 0" },
          categoryName: { type: "string", description: "שם הקטגוריה שאליה המנה שייכת" },
          modifierGroups: {
            type: "array",
            description: "קבוצות תוספות/אפשרויות של המנה (גדלים, תוספות, רטבים). ריק אם אין.",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                name: { type: "string" },
                type: {
                  type: "string",
                  enum: ["single", "multi"],
                  description: "single = בחירה אחת (למשל גודל), multi = בחירה מרובה (למשל תוספות)",
                },
                required: { type: "boolean" },
                options: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      name: { type: "string" },
                      priceDelta: { type: "number", description: "תוספת מחיר בשקלים שלמים, 0 אם כלול" },
                    },
                    required: ["name", "priceDelta"],
                  },
                },
              },
              required: ["name", "type", "required", "options"],
            },
          },
        },
        required: ["name", "description", "price", "categoryName", "modifierGroups"],
      },
    },
  },
  required: ["categories", "items"],
} as const;

const PROMPT = `אתה ממיר תפריט של מסעדה לפורמט מובנה.
קיבלת קובץ תפריט (PDF או תמונה). חלץ ממנו את כל המנות, בלי להמציא מנות שלא קיימות.

כללים:
- לכל מנה: שם, תיאור (אם יש), מחיר בשקלים שלמים (עגל למספר שלם), ושם הקטגוריה שאליה היא שייכת.
- אם יש למנה גדלים/תוספות/אפשרויות בחירה — הוצא אותם כ-modifierGroups. גודל/בחירה יחידה = type "single"; תוספות מרובות = type "multi".
- priceDelta של אופציה = התוספת למחיר בשקלים (0 אם כלולה ללא תוספת).
- אל תכלול תמונות. אל תמציא מחירים — אם מחיר לא מופיע, השתמש ב-0.
- שמור על השפה המקורית של התפריט (עברית/אנגלית/ערבית).
- categories = רשימת כל שמות הקטגוריות, לפי הסדר.

החזר JSON בלבד לפי הסכמה.`;

type ImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

function imageMediaType(mimeType: string): ImageMediaType {
  if (mimeType === "image/jpg" || mimeType === "image/jpeg") return "image/jpeg";
  if (mimeType === "image/png") return "image/png";
  if (mimeType === "image/webp") return "image/webp";
  if (mimeType === "image/gif") return "image/gif";
  return "image/jpeg";
}

function fileBlock(mimeType: string, base64: string): Anthropic.ContentBlockParam {
  if (mimeType === "application/pdf") {
    return {
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: base64 },
    };
  }
  return {
    type: "image",
    source: { type: "base64", media_type: imageMediaType(mimeType), data: base64 },
  };
}

/**
 * Send an uploaded menu file (PDF or image) to Claude and get back a
 * normalized ExtractedMenu. Uses structured outputs (output_config.format) so
 * the result is always valid JSON in our shape - no markdown fences, no prose.
 * Prices are rounded to integer shekels.
 */
export async function extractMenuFromFile(opts: {
  apiKey: string;
  bytes: Buffer;
  mimeType: string;
}): Promise<ExtractedMenu> {
  let raw: string | null = null;
  try {
    const client = new Anthropic({ apiKey: opts.apiKey });
    const message = await client.messages.create({
      model: MENU_IMPORT_MODEL,
      max_tokens: 16000,
      output_config: {
        format: { type: "json_schema", schema: RESPONSE_SCHEMA as Record<string, unknown> },
      },
      messages: [
        {
          role: "user",
          content: [fileBlock(opts.mimeType, opts.bytes.toString("base64")), { type: "text", text: PROMPT }],
        },
      ],
    });
    if (message.stop_reason === "refusal") {
      throw new MenuExtractError("refused", "המערכת דחתה את הקובץ. נסה קובץ אחר.");
    }
    for (const block of message.content) {
      if (block.type === "text") {
        raw = block.text;
        break;
      }
    }
  } catch (err) {
    if (err instanceof MenuExtractError) throw err;
    throw new MenuExtractError(
      "extract_failed",
      err instanceof Error ? err.message : "AI extraction failed",
    );
  }

  if (!raw) {
    throw new MenuExtractError("bad_extraction", "לא הצלחנו לפענח את התפריט מהקובץ");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new MenuExtractError("bad_extraction", "לא הצלחנו לפענח את התפריט מהקובץ");
  }

  return normalize(parsed);
}

function normalize(parsed: unknown): ExtractedMenu {
  const obj = (parsed ?? {}) as Record<string, unknown>;
  const catSet = new Map<string, true>();
  for (const c of asArray(obj.categories)) {
    const name = String(c ?? "").trim();
    if (name) catSet.set(name, true);
  }

  const items: ExtractedMenu["items"] = [];
  for (const rawItem of asArray(obj.items)) {
    const it = (rawItem ?? {}) as Record<string, unknown>;
    const name = String(it.name ?? "").trim();
    if (!name) continue;
    const categoryName = String(it.categoryName ?? "").trim() || "ללא קטגוריה";
    catSet.set(categoryName, true);

    const modifierGroups: ExtractedMenu["items"][number]["modifierGroups"] = [];
    for (const rawGroup of asArray(it.modifierGroups)) {
      const g = (rawGroup ?? {}) as Record<string, unknown>;
      const gName = String(g.name ?? "").trim();
      if (!gName) continue;
      const type = g.type === "multi" ? "multi" : "single";
      const options: ExtractedMenu["items"][number]["modifierGroups"][number]["options"] = [];
      for (const rawOpt of asArray(g.options)) {
        const o = (rawOpt ?? {}) as Record<string, unknown>;
        const oName = String(o.name ?? "").trim();
        if (!oName) continue;
        options.push({ name: oName, priceDelta: toInt(o.priceDelta) });
      }
      const required = Boolean(g.required);
      modifierGroups.push({
        name: gName,
        type,
        required,
        minSelect: required ? 1 : 0,
        maxSelect: type === "single" ? 1 : Math.max(1, options.length || 1),
        options,
      });
    }

    items.push({
      name,
      description: String(it.description ?? "").trim(),
      price: toInt(it.price),
      categoryName,
      modifierGroups,
    });
  }

  return { categories: Array.from(catSet.keys()), items };
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function toInt(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}
