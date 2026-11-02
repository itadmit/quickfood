import { translateBatch, type TransItem } from "./translate";
import type { Lang } from "./langs";

/**
 * Collect the merchant-authored strings shown on the storefront, translate
 * them in one batched+cached pass, and return a `localize(type,id,field,src)`
 * lookup. Hebrew is an identity function (no work). Anything untranslated
 * falls back to the Hebrew source, so the page always renders.
 */
export interface MenuContentSources {
  categories?: { id: string; name: string }[];
  items?: { id: string; name: string; description?: string | null }[];
  deals?: { id: string; name: string; description?: string | null }[];
  notices?: { id: string; title?: string | null; body?: string | null }[];
}

export type Localize = (
  entityType: string,
  id: string,
  field: string,
  source: string | null | undefined,
) => string;

export async function buildMenuLocalizer(
  tenantId: string,
  lang: Lang,
  sources: MenuContentSources,
): Promise<Localize> {
  if (lang === "he") return (_t, _i, _f, source) => source ?? "";

  const items: TransItem[] = [];
  const push = (entityType: string, id: string, field: string, text: string | null | undefined) => {
    if (text && text.trim()) items.push({ entityType, entityId: id, field, text });
  };

  for (const c of sources.categories ?? []) push("menu_category", c.id, "name", c.name);
  for (const it of sources.items ?? []) {
    push("menu_item", it.id, "name", it.name);
    push("menu_item", it.id, "description", it.description);
  }
  for (const d of sources.deals ?? []) {
    push("deal", d.id, "name", d.name);
    push("deal", d.id, "description", d.description);
  }
  for (const n of sources.notices ?? []) {
    push("notice", n.id, "title", n.title);
    push("notice", n.id, "body", n.body);
  }

  const map = await translateBatch(tenantId, items, lang);
  return (entityType, id, field, source) =>
    map.get(`${entityType}:${id}:${field}`) ?? source ?? "";
}
