import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import type { ExtractedMenu } from "./types";

export const MENU_IMPORT_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

export class MenuExtractError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

const RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    categories: {
      type: SchemaType.ARRAY,
      description: "כל שמות הקטגוריות בתפריט, לפי הסדר שבו הופיעו",
      items: { type: SchemaType.STRING },
    },
    items: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING, description: "שם המנה" },
          description: { type: SchemaType.STRING, description: "תיאור המנה אם קיים, אחרת מחרוזת ריקה" },
          price: { type: SchemaType.NUMBER, description: "מחיר המנה בשקלים שלמים (מספר). אם אין מחיר, 0" },
          categoryName: { type: SchemaType.STRING, description: "שם הקטגוריה שאליה המנה שייכת" },
          modifierGroups: {
            type: SchemaType.ARRAY,
            description: "קבוצות תוספות/אפשרויות של המנה (גדלים, תוספות, רטבים). ריק אם אין.",
            items: {
              type: SchemaType.OBJECT,
              properties: {
                name: { type: SchemaType.STRING },
                type: {
                  type: SchemaType.STRING,
                  format: "enum",
                  enum: ["single", "multi"],
                  description: "single = בחירה אחת (למשל גודל), multi = בחירה מרובה (למשל תוספות)",
                },
                required: { type: SchemaType.BOOLEAN },
                options: {
                  type: SchemaType.ARRAY,
                  items: {
                    type: SchemaType.OBJECT,
                    properties: {
                      name: { type: SchemaType.STRING },
                      priceDelta: { type: SchemaType.NUMBER, description: "תוספת מחיר בשקלים שלמים, 0 אם כלול" },
                    },
                    required: ["name"],
                  },
                },
              },
              required: ["name", "type", "options"],
            },
          },
        },
        required: ["name", "categoryName", "price", "modifierGroups"],
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

/**
 * Send an uploaded menu file (PDF or image) to Gemini and get back a
 * normalized ExtractedMenu. Uses Gemini's structured-output mode
 * (responseSchema) so the result is always valid JSON in our shape - no
 * markdown fences, no prose. Prices are rounded to integer shekels.
 */
export async function extractMenuFromFile(opts: {
  apiKey: string;
  bytes: Buffer;
  mimeType: string;
}): Promise<ExtractedMenu> {
  let raw: string;
  try {
    const genAI = new GoogleGenerativeAI(opts.apiKey);
    const model = genAI.getGenerativeModel({
      model: MENU_IMPORT_MODEL,
      generationConfig: {
        responseMimeType: "application/json",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        responseSchema: RESPONSE_SCHEMA as any,
      },
    });
    const result = await model.generateContent([
      { inlineData: { mimeType: opts.mimeType, data: opts.bytes.toString("base64") } },
      { text: PROMPT },
    ]);
    raw = result.response.text();
  } catch (err) {
    throw new MenuExtractError(
      "extract_failed",
      err instanceof Error ? err.message : "AI extraction failed",
    );
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
