import { GoogleGenerativeAI, SchemaType, type Content, type FunctionDeclaration } from "@google/generative-ai";
import type { AIMenuSnapshot } from "./menu-snapshot";
import { serializeMenuForPrompt } from "./menu-snapshot";

export interface AIRecentOrder {
  orderNumber?: number;
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

export function buildSystemPrompt(input: BuildPromptInput): string {
  const { menu, recentOrders, currentCart, customerName } = input;
  const parts: string[] = [];

  parts.push(
    `אתה יועץ-הזמנות חכם של ${menu.tenantName}. תפקידך לעזור ללקוח לבחור מנות ולהרכיב הזמנה נכונה.`,
  );
  parts.push(``);
  parts.push(`### כללי שיחה`);
  parts.push(`- דבר עברית, חם, ידידותי, קצר (1-3 משפטים בכל תור).`);
  parts.push(`- אל תמציא פריטים שלא בתפריט. אם הלקוח רוצה משהו שלא קיים — תגיד.`);
  parts.push(`- כשמתאים, השתמש בכלי \`recommend_items\` כדי להציג כרטיסי-פריט (עד 4) לבחירה ויזואלית.`);
  parts.push(`- כשהלקוח מאשר פריט ספציפי — השתמש ב-\`propose_add_to_cart\` עם options תקפים.`);
  parts.push(`- חובה לבחור options מקבוצות שמסומנות "חובה" (required) ולמלא את minSelect.`);
  parts.push(`- לעולם אל תחרוג מ-maxSelect.`);
  parts.push(`- כל id שאתה מחזיר חייב להופיע בדיוק בתפריט למטה.`);
  parts.push(`- אם הלקוח לא הזכיר העדפות — שאל שאלה ממוקדת אחת (טבעוני? עם בשר? חריף?) לפני המלצה.`);
  parts.push(``);

  if (customerName) {
    parts.push(`### לקוח`);
    parts.push(`שם הלקוח: ${customerName}`);
    parts.push(``);
  }

  if (recentOrders.length > 0) {
    parts.push(`### הזמנות אחרונות של הלקוח (לפי סדר זמן יורד)`);
    for (const o of recentOrders.slice(0, 5)) {
      const summary = o.items.map((i) => `${i.quantity}× ${i.name}`).join(", ");
      parts.push(`- ${o.createdAt}: ${summary}`);
    }
    parts.push(`השתמש בזה כדי להציע "כמו בפעם הקודמת" כשמתאים.`);
    parts.push(``);
  }

  if (currentCart.length > 0) {
    parts.push(`### עגלה נוכחית`);
    for (const l of currentCart) {
      const opts = l.options?.length ? ` (${l.options.join(", ")})` : "";
      parts.push(`- ${l.quantity}× ${l.name}${l.sizeName ? ` ${l.sizeName}` : ""}${opts}`);
    }
    parts.push(``);
  }

  parts.push(serializeMenuForPrompt(menu));
  return parts.join("\n");
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

export async function* streamGeminiChat(opts: {
  apiKey: string;
  systemInstruction: string;
  history: Content[];
  message: string;
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
      if (text) yield { kind: "text", text };
      const calls = chunk.functionCalls?.();
      if (calls && calls.length > 0) {
        for (const call of calls) {
          yield {
            kind: "tool",
            toolName: call.name,
            toolArgs: (call.args as Record<string, unknown>) ?? {},
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
