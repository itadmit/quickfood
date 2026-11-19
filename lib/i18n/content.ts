import { cookies } from "next/headers";
import { prisma } from "@/lib/db/client";
import { LANG_COOKIE, resolveLang, type Lang } from "./langs";
import { translateBatch, type TransItem } from "./translate";

export async function requestLang(enabled: string[] | null | undefined): Promise<Lang> {
  return resolveLang((await cookies()).get(LANG_COOKIE)?.value, enabled ?? ["he"]);
}

export function contentKey(entityType: string, entityId: string, field: string): string {
  return `${entityType}:${entityId}:${field}`;
}

export function cityEntityId(tenantId: string, city: string): string {
  return `${tenantId}:${city}`;
}

const CART_ENTITY_TYPES = ["menu_item", "item_option", "option_group", "item_size"];

export async function loadStorefrontContent(
  tenantId: string,
  lang: Lang,
  extras: TransItem[],
): Promise<Record<string, string>> {
  if (lang === "he") return {};
  const [rows, translated] = await Promise.all([
    prisma.translation
      .findMany({
        where: { tenantId, lang, entityType: { in: CART_ENTITY_TYPES }, field: "name" },
        select: { entityType: true, entityId: true, field: true, text: true },
      })
      .catch(() => []),
    translateBatch(tenantId, extras, lang),
  ]);
  const out: Record<string, string> = {};
  for (const r of rows) out[contentKey(r.entityType, r.entityId, r.field)] = r.text;
  for (const [k, v] of translated) out[k] = v;
  return out;
}
