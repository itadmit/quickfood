import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { translationSourceHash } from "@/lib/i18n/translate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Manual menu translation editor backend. GET returns every category + item
 * with its Hebrew source and the current translation (manual override or the
 * cached auto result) for one language. PUT upserts manual overrides (or clears
 * them when the text is blank). Manual rows always win and are never
 * re-translated (see lib/i18n/translate.ts).
 */

export const GET = handler(async (req: Request) => {
  const session = await requireMerchant();
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const lang = new URL(req.url).searchParams.get("lang");
  if (lang !== "en" && lang !== "ru") {
    return apiError("validation_error", "lang must be en or ru", 422, "lang");
  }

  const [cats, items, trans] = await Promise.all([
    prisma.menuCategory.findMany({
      where: { tenantId: session.tenantId },
      orderBy: { position: "asc" },
      select: { id: true, name: true },
    }),
    prisma.menuItem.findMany({
      where: { tenantId: session.tenantId },
      orderBy: [{ categoryId: "asc" }, { position: "asc" }],
      select: { id: true, name: true, description: true, categoryId: true },
    }),
    prisma.translation.findMany({
      where: { tenantId: session.tenantId, lang },
      select: { entityType: true, entityId: true, field: true, text: true, manual: true },
    }),
  ]);

  const tmap = new Map(trans.map((t) => [`${t.entityType}:${t.entityId}:${t.field}`, t]));
  const get = (type: string, id: string, field: string) => tmap.get(`${type}:${id}:${field}`);

  return apiJson({
    lang,
    categories: cats.map((c) => {
      const t = get("menu_category", c.id, "name");
      return { id: c.id, name_he: c.name, name_tr: t?.text ?? "", name_manual: !!t?.manual };
    }),
    items: items.map((i) => {
      const tn = get("menu_item", i.id, "name");
      const td = get("menu_item", i.id, "description");
      return {
        id: i.id,
        category_id: i.categoryId,
        name_he: i.name,
        name_tr: tn?.text ?? "",
        name_manual: !!tn?.manual,
        desc_he: i.description ?? "",
        desc_tr: td?.text ?? "",
        desc_manual: !!td?.manual,
      };
    }),
  });
});

const PutSchema = z.object({
  lang: z.enum(["en", "ru"]),
  entries: z
    .array(
      z.object({
        entity_type: z.enum(["menu_item", "menu_category"]),
        entity_id: z.string().uuid(),
        field: z.enum(["name", "description"]),
        text: z.string().max(2000),
      }),
    )
    .max(3000),
});

export const PUT = handler(async (req: Request) => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const body = PutSchema.parse(await req.json());
  const tenantId = session.tenantId;

  const itemIds = [...new Set(body.entries.filter((e) => e.entity_type === "menu_item").map((e) => e.entity_id))];
  const catIds = [...new Set(body.entries.filter((e) => e.entity_type === "menu_category").map((e) => e.entity_id))];
  const [items, cats] = await Promise.all([
    itemIds.length
      ? prisma.menuItem.findMany({ where: { tenantId, id: { in: itemIds } }, select: { id: true, name: true, description: true } })
      : [],
    catIds.length
      ? prisma.menuCategory.findMany({ where: { tenantId, id: { in: catIds } }, select: { id: true, name: true } })
      : [],
  ]);
  const itemMap = new Map(items.map((i) => [i.id, i]));
  const catMap = new Map(cats.map((c) => [c.id, c]));

  const ops = [];
  for (const e of body.entries) {
    // Resolve the current Hebrew source (also enforces tenant ownership).
    let source: string | null = null;
    if (e.entity_type === "menu_item") {
      const it = itemMap.get(e.entity_id);
      if (!it) continue;
      source = e.field === "name" ? it.name : it.description ?? "";
    } else {
      const c = catMap.get(e.entity_id);
      if (!c) continue;
      source = c.name;
    }

    const text = e.text.trim();
    if (!text) {
      // Blank clears the override → falls back to auto-translation.
      ops.push(
        prisma.translation.deleteMany({
          where: { tenantId, entityType: e.entity_type, entityId: e.entity_id, field: e.field, lang: body.lang },
        }),
      );
    } else {
      ops.push(
        prisma.translation.upsert({
          where: {
            entityType_entityId_field_lang: {
              entityType: e.entity_type,
              entityId: e.entity_id,
              field: e.field,
              lang: body.lang,
            },
          },
          create: {
            tenantId,
            entityType: e.entity_type,
            entityId: e.entity_id,
            field: e.field,
            lang: body.lang,
            sourceHash: translationSourceHash(source),
            text,
            manual: true,
          },
          update: { sourceHash: translationSourceHash(source), text, manual: true },
        }),
      );
    }
  }

  await prisma.$transaction(ops);
  return apiJson({ saved: ops.length });
});
