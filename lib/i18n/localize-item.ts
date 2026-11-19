import type { MenuItemForCustomer } from "@/lib/menu-item-load";
import type { Lang } from "./langs";
import { translateBatch, type TransItem } from "./translate";

export async function localizeMenuItem(
  tenantId: string,
  lang: Lang,
  item: MenuItemForCustomer,
): Promise<MenuItemForCustomer> {
  if (lang === "he") return item;
  const items: TransItem[] = [];
  const push = (entityType: string, entityId: string, field: string, text: string | null | undefined) => {
    if (text && text.trim()) items.push({ entityType, entityId, field, text });
  };
  push("menu_item", item.id, "name", item.name);
  push("menu_item", item.id, "description", item.description);
  push("menu_item", item.id, "imageNote", item.imageNote);
  for (const s of item.sizes) push("item_size", s.id, "name", s.name);
  for (const g of item.optionGroups) {
    push("option_group", g.id, "name", g.name);
    push("option_group", g.id, "helpText", g.helpText);
    for (const o of g.options) push("item_option", o.id, "name", o.name);
  }
  const map = await translateBatch(tenantId, items, lang);
  const tr = <T extends string | null>(entityType: string, id: string, field: string, src: T): T =>
    src ? ((map.get(`${entityType}:${id}:${field}`) ?? src) as T) : src;
  return {
    ...item,
    name: tr("menu_item", item.id, "name", item.name),
    description: tr("menu_item", item.id, "description", item.description),
    imageNote: tr("menu_item", item.id, "imageNote", item.imageNote),
    sizes: item.sizes.map((s) => ({ ...s, name: tr("item_size", s.id, "name", s.name) })),
    optionGroups: item.optionGroups.map((g) => ({
      ...g,
      name: tr("option_group", g.id, "name", g.name),
      helpText: tr("option_group", g.id, "helpText", g.helpText),
      options: g.options.map((o) => ({ ...o, name: tr("item_option", o.id, "name", o.name) })),
    })),
  };
}
