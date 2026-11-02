import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "crypto";
import { prisma } from "@/lib/db/client";
import type { Lang } from "./langs";

/**
 * Auto-translation of merchant-authored storefront content (menu names,
 * descriptions, categories, options, …) into en/ru, cached in the Translation
 * table. UI chrome is NOT handled here — that comes from the static dictionary.
 *
 * Design:
 *  - One batched Claude call per page-load for the strings that are missing or
 *    whose Hebrew source changed (sourceHash mismatch). Everything else is a
 *    cache hit, so steady-state reads never touch the LLM.
 *  - Best-effort: any failure (no key, API error, shape mismatch) falls back
 *    to the Hebrew source so the storefront never breaks.
 *  - Hebrew (`he`) is a no-op passthrough.
 */

const TRANSLATE_MODEL =
  process.env.TRANSLATE_MODEL || process.env.CLAUDE_MODEL || "claude-haiku-4-5-20251001";

const LANG_NAME: Record<Exclude<Lang, "he">, string> = {
  en: "English",
  ru: "Russian",
};

export interface TransItem {
  entityType: string;
  entityId: string;
  field: string;
  text: string;
}

function keyOf(i: { entityType: string; entityId: string; field: string }): string {
  return `${i.entityType}:${i.entityId}:${i.field}`;
}

function sourceHash(s: string): string {
  return createHash("sha256").update(s).digest("hex").slice(0, 32);
}

/**
 * Translate `items` into `lang`, returning a map keyed `type:id:field` →
 * translated text (Hebrew source as fallback). Safe to call on every render —
 * it reads the cache first and only sends cache-misses to Claude.
 */
export async function translateBatch(
  tenantId: string,
  items: TransItem[],
  lang: Lang,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const real = items.filter((i) => i.text && i.text.trim().length > 0);

  // Hebrew (source) or nothing to do → passthrough.
  if (lang === "he" || real.length === 0) {
    for (const i of items) out.set(keyOf(i), i.text);
    return out;
  }

  const cached = await prisma.translation.findMany({
    where: {
      tenantId,
      lang,
      OR: real.map((i) => ({
        entityType: i.entityType,
        entityId: i.entityId,
        field: i.field,
      })),
    },
    select: { entityType: true, entityId: true, field: true, sourceHash: true, text: true },
  });
  const cachedMap = new Map(cached.map((c) => [keyOf(c), c]));

  const misses: TransItem[] = [];
  for (const i of real) {
    const c = cachedMap.get(keyOf(i));
    if (c && c.sourceHash === sourceHash(i.text)) out.set(keyOf(i), c.text);
    else misses.push(i);
  }

  if (misses.length > 0) {
    const translated = await callClaude(
      misses.map((m) => m.text),
      lang,
    ).catch((e) => {
      console.error("[i18n] translate batch failed:", e);
      return null;
    });

    if (translated && translated.length === misses.length) {
      await Promise.all(
        misses.map((m, idx) => {
          const text = translated[idx];
          out.set(keyOf(m), text);
          return prisma.translation
            .upsert({
              where: {
                entityType_entityId_field_lang: {
                  entityType: m.entityType,
                  entityId: m.entityId,
                  field: m.field,
                  lang,
                },
              },
              create: {
                tenantId,
                entityType: m.entityType,
                entityId: m.entityId,
                field: m.field,
                lang,
                sourceHash: sourceHash(m.text),
                text,
              },
              update: { sourceHash: sourceHash(m.text), text, manual: false },
            })
            .catch(() => {});
        }),
      );
    }
  }

  // Fallback: anything still unresolved (empty, failed, non-translatable) keeps
  // its Hebrew source so the page always renders something.
  for (const i of items) if (!out.has(keyOf(i))) out.set(keyOf(i), i.text);
  return out;
}

async function callClaude(texts: string[], lang: Exclude<Lang, "he">): Promise<string[] | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey });
  const system =
    `You are a professional menu translator for a food-ordering storefront. ` +
    `Translate each Hebrew string into ${LANG_NAME[lang]}. Keep it natural, ` +
    `concise and appetizing. Keep proper brand/dish names that have no common ` +
    `translation. Never add notes or quotes around items. Return ONLY a JSON ` +
    `array of strings — same length and same order as the input array.`;

  const res = await client.messages.create({
    model: TRANSLATE_MODEL,
    max_tokens: 4096,
    system,
    messages: [{ role: "user", content: JSON.stringify(texts) }],
  });

  const block = res.content.find((b) => b.type === "text");
  const raw = block && block.type === "text" ? block.text : "";
  return parseJsonArray(raw, texts.length);
}

function parseJsonArray(raw: string, expectedLength: number): string[] | null {
  try {
    const start = raw.indexOf("[");
    const end = raw.lastIndexOf("]");
    if (start < 0 || end <= start) return null;
    const arr = JSON.parse(raw.slice(start, end + 1));
    if (
      Array.isArray(arr) &&
      arr.length === expectedLength &&
      arr.every((x) => typeof x === "string")
    ) {
      return arr as string[];
    }
    return null;
  } catch {
    return null;
  }
}
