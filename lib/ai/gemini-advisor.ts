import { GoogleGenerativeAI, SchemaType, type Content, type FunctionDeclaration } from "@google/generative-ai";
import type { AIMenuSnapshot, ShortIdMap } from "./menu-snapshot";
import { buildShortIdMap, serializeMenuForPrompt } from "./menu-snapshot";

export interface AIRecentOrder {
  orderNumber?: string | number;
  createdAt: string;
  items: Array<{ name: string; quantity: number }>;
}

export interface AICartLine {
  name: string;
  quantity: number;
  sizeName?: string | null;
  options?: string[];
}

export interface BuildPromptInput {
  menu: AIMenuSnapshot;
  recentOrders: AIRecentOrder[];
  currentCart: AICartLine[];
  customerName?: string | null;
}

export interface BuiltPrompt {
  systemInstruction: string;
  idMap: ShortIdMap;
}

export function buildSystemPrompt(input: BuildPromptInput): BuiltPrompt {
  const { menu, recentOrders, currentCart, customerName } = input;
  const idMap = buildShortIdMap(menu);
  const parts: string[] = [];

  parts.push(
    `יועץ-הזמנות של ${menu.tenantName}. עזור ללקוח לבחור מנות לפי התפריט בלבד.`,
  );
  parts.push(``);
  parts.push(`כללים:`);
  parts.push(`1. עברית, קצר (משפט-שניים).`);
  parts.push(`2. כשממליץ על 2+ פריטים — חובה לקרוא ל-recommend_items עם ה-IDs מהתפריט. אל תרשום אותם בטקסט.`);
  parts.push(`3. פריט מוגדר → propose_add_to_cart. מילוי options חובה (סימן !) לפי minSelect, לא לעבור maxSelect.`);
  parts.push(`4. אל תמציא — רק IDs מהתפריט. הסבר אם משהו לא קיים.`);
  parts.push(`5. בלי markdown (אין * או **).`);
  parts.push(``);
  parts.push(`פורמט תפריט: x#=שם|מחיר. ! = חובה. * = ברירת מחדל. ½ = חצי-חצי. (מספר חינם) = הראשונים חינם.`);
  parts.push(``);

  if (customerName) {
    parts.push(`לקוח: ${customerName}`);
  }

  if (recentOrders.length > 0) {
    parts.push(`הזמנות קודמות:`);
    for (const o of recentOrders.slice(0, 3)) {
      parts.push(`${o.createdAt}: ${o.items.map((i) => `${i.quantity}×${i.name}`).join(",")}`);
    }
  }

  if (currentCart.length > 0) {
    parts.push(`בעגלה:`);
    for (const l of currentCart) {
      const opts = l.options?.length ? `(${l.options.join(",")})` : "";
      parts.push(`${l.quantity}×${l.name}${l.sizeName ? ` ${l.sizeName}` : ""}${opts}`);
    }
  }

  parts.push(``);
  parts.push(serializeMenuForPrompt(menu, idMap));
  return { systemInstruction: parts.join("\n"), idMap };
}

export const ADVISOR_TOOLS: FunctionDeclaration[] = [
  {
    name: "recommend_items",
    description:
      "הצג ללקוח כרטיסי-פריט להמלצה (עד 4). השתמש בזה כשאתה ממליץ על אופציות אבל הלקוח עדיין לא בחר.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        item_ids: {
          type: SchemaType.ARRAY,
          description: "מזהי פריטים בתפריט (id מהשדה id=)",
          items: { type: SchemaType.STRING },
        },
        reason: {
          type: SchemaType.STRING,
          description: "משפט קצר שמסביר ללקוח למה אלו ההמלצות.",
        },
      },
      required: ["item_ids"],
    },
  },
  {
    name: "propose_add_to_cart",
    description:
      "הצע ללקוח להוסיף פריט מוגדר לעגלה (עם מידה ותוספות). הלקוח יאשר בלחיצה לפני שזה נכנס לעגלה.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        item_id: { type: SchemaType.STRING, description: "id של הפריט מהתפריט" },
        quantity: { type: SchemaType.INTEGER, description: "כמות (ברירת מחדל 1)" },
        size_id: {
          type: SchemaType.STRING,
          description: "id של המידה אם לפריט יש מידות, אחרת השאר ריק",
        },
        option_ids: {
          type: SchemaType.ARRAY,
          description: "id-ים של תוספות נבחרות (אופציונלי)",
          items: { type: SchemaType.STRING },
        },
        notes: {
          type: SchemaType.STRING,
          description: "הערה אופציונלית (למשל 'בלי בצל')",
        },
      },
      required: ["item_id"],
    },
  },
];

export interface ChatMessage {
  role: "user" | "model";
  text: string;
}

export function toGeminiHistory(messages: ChatMessage[]): Content[] {
  return messages.map((m) => ({
    role: m.role,
    parts: [{ text: m.text }],
  }));
}

export interface StreamEvent {
  kind: "text" | "tool" | "done" | "error";
  text?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  error?: string;
}

function stripMarkdown(text: string): string {
  return text.replace(/\*\*/g, "").replace(/(^|\s)\*(?=\S)/g, "$1• ").replace(/`/g, "");
}

function translateToolArgs(args: Record<string, unknown>, idMap: ShortIdMap): Record<string, unknown> {
  const out: Record<string, unknown> = { ...args };
  const toReal = (v: unknown) =>
    typeof v === "string" ? (idMap.toReal[v] ?? v) : v;
  if (Array.isArray(out.item_ids)) out.item_ids = (out.item_ids as unknown[]).map(toReal);
  if (Array.isArray(out.option_ids)) out.option_ids = (out.option_ids as unknown[]).map(toReal);
  if ("item_id" in out) out.item_id = toReal(out.item_id);
  if ("size_id" in out) out.size_id = toReal(out.size_id);
  return out;
}

export async function* streamGeminiChat(opts: {
  apiKey: string;
  systemInstruction: string;
  history: Content[];
  message: string;
  idMap: ShortIdMap;
}): AsyncGenerator<StreamEvent> {
  try {
    const genAI = new GoogleGenerativeAI(opts.apiKey);
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      systemInstruction: opts.systemInstruction,
      tools: [{ functionDeclarations: ADVISOR_TOOLS }],
    });
    const chat = model.startChat({ history: opts.history });
    const result = await chat.sendMessageStream(opts.message);

    for await (const chunk of result.stream) {
      const text = chunk.text?.();
      if (text) yield { kind: "text", text: stripMarkdown(text) };
      const calls = chunk.functionCalls?.();
      if (calls && calls.length > 0) {
        for (const call of calls) {
          const args = (call.args as Record<string, unknown>) ?? {};
          yield {
            kind: "tool",
            toolName: call.name,
            toolArgs: translateToolArgs(args, opts.idMap),
          };
        }
      }
    }
    yield { kind: "done" };
  } catch (err) {
    yield {
      kind: "error",
      error: humanizeGeminiError(err),
    };
  }
}

export async function pingGemini(apiKey: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-2.5-flash" });
    const res = await model.generateContent("Reply with the single word: OK");
    const text = res.response.text();
    return { ok: text.trim().toUpperCase().includes("OK") };
  } catch (err) {
    return { ok: false, error: humanizeGeminiError(err) };
  }
}

function humanizeGeminiError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (/\b429\b|quota|rate.?limit|Too Many Requests/i.test(raw)) {
    return "המכסה החינמית של Gemini מוצתה. נסה שוב בעוד דקה, או שדרג את החשבון ב-Google AI Studio.";
  }
  if (/\b403\b|API key.*not valid|API_KEY_INVALID/i.test(raw)) {
    return "המפתח לא תקין או חסר הרשאות. בדוק/י את המפתח ב-Google AI Studio.";
  }
  if (/\b404\b|not found.*model/i.test(raw)) {
    return "מודל ה-AI אינו זמין כרגע. פנו לתמיכה.";
  }
  return raw || "שגיאה לא ידועה";
}
