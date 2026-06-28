import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "@/lib/db/client";
import { decryptSecret } from "@/lib/crypto/secrets";
import type { GrowthInsight } from "./insights";

const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-haiku-4-5-20251001";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const TIMEOUT_MS = 9000;

const ALLOWED_ACTIONS = new Set(["create_coupon", "create_qr", "send_campaign", "external_action"]);

const SYSTEM = [
  "אתה מנהל צמיחה של מסעדה בפלטפורמת הזמנות ישראלית (QuickFood).",
  "המטרה: להפוך לקוחות שהגיעו מאפליקציות משלוחים / גוגל / רשתות / מזדמנים - ללקוחות ישירים שמזמינים מהאתר של המסעדה.",
  "קיבלת FACTS - נתונים אמיתיים שחושבו מהמערכת. הפק 3-5 תובנות מעשיות.",
  "חוקים מחייבים:",
  "1. השתמש אך ורק במספרים שמופיעים ב-FACTS. אסור להמציא מספרים או עובדות.",
  "2. כל תובנה = תצפית קצרה + פעולה מומלצת + תועלת צפויה. בעברית, שפה של בעל מסעדה (בלי ז'רגון).",
  "3. תמיד התייחס לעמלות/חיסכון כ'משוער', לעולם לא כמדויק.",
  "4. אם אין מספיק נתונים על משהו - אל תמציא, פשוט אל תכלול אותו.",
  "החזר JSON תקין בלבד (ללא markdown), מערך של אובייקטים:",
  '[{"title": string, "body": string, "expectedImpact": string, "priority": "high"|"medium"|"low", "actionType": "create_coupon"|"create_qr"|"send_campaign"|"external_action", "actionLabel": string}]',
].join("\n");

function parseJsonArray(text: string): unknown[] | null {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("[");
  const end = t.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const v = JSON.parse(t.slice(start, end + 1));
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

function coerce(raw: unknown[]): GrowthInsight[] {
  const out: GrowthInsight[] = [];
  raw.forEach((item, i) => {
    if (!item || typeof item !== "object") return;
    const o = item as Record<string, unknown>;
    const title = typeof o.title === "string" ? o.title.trim() : "";
    const body = typeof o.body === "string" ? o.body.trim() : "";
    if (!title || !body) return;
    const priority =
      o.priority === "high" || o.priority === "low" ? o.priority : "medium";
    const actionType =
      typeof o.actionType === "string" && ALLOWED_ACTIONS.has(o.actionType)
        ? o.actionType
        : undefined;
    out.push({
      id: `ai_${i}`,
      title,
      body,
      expectedImpact: typeof o.expectedImpact === "string" ? o.expectedImpact : undefined,
      priority,
      actionType,
      actionLabel: typeof o.actionLabel === "string" ? o.actionLabel : undefined,
    });
  });
  return out.slice(0, 6);
}

async function callClaude(apiKey: string, facts: string): Promise<string> {
  const client = new Anthropic({ apiKey });
  const resp = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1200,
    system: SYSTEM,
    messages: [{ role: "user", content: `FACTS:\n${facts}` }],
  });
  return resp.content.map((b) => (b.type === "text" ? b.text : "")).join("");
}

async function callGemini(apiKey: string, facts: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: { responseMimeType: "application/json" },
  });
  const r = await model.generateContent(`${SYSTEM}\n\nFACTS:\n${facts}`);
  return r.response.text();
}

/**
 * LLM-backed growth insights. Resolves the tenant's configured AI provider +
 * key; returns null when no AI is configured or on any error (caller falls
 * back to the deterministic rule-based insights). Never invents data - the
 * prompt hard-constrains the model to the supplied FACTS, and we time-box the
 * call so it can't slow the morning page.
 */
export async function generateAiInsights(
  tenantId: string,
  facts: Record<string, unknown>,
): Promise<GrowthInsight[] | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { aiProvider: true, aiClaudeApiKey: true, aiGeminiApiKey: true },
  });
  if (!tenant) return null;

  const provider = tenant.aiProvider;
  const encrypted = provider === "claude" ? tenant.aiClaudeApiKey : tenant.aiGeminiApiKey;
  if (!encrypted) return null;

  let apiKey: string;
  try {
    apiKey = decryptSecret(encrypted);
  } catch {
    return null;
  }

  const factsStr = JSON.stringify(facts);

  try {
    const text = await Promise.race([
      provider === "claude" ? callClaude(apiKey, factsStr) : callGemini(apiKey, factsStr),
      new Promise<string>((_, reject) => setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS)),
    ]);
    const arr = parseJsonArray(text);
    if (!arr) return null;
    const insights = coerce(arr);
    return insights.length > 0 ? insights : null;
  } catch {
    return null;
  }
}
