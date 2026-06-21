import { Prisma } from "@prisma/client";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { extractMenuFromFile, MenuExtractError, MENU_IMPORT_MODEL } from "@/lib/menu-import/extract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// One preview per minute per tenant - extraction is a billed model call,
// this stops a double-click from firing two.
const PREVIEW_COOLDOWN_MS = 60_000;
const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED: Record<string, "pdf" | "image"> = {
  "application/pdf": "pdf",
  "image/png": "image",
  "image/jpeg": "image",
  "image/jpg": "image",
  "image/webp": "image",
};

// Platform Claude key - menu extraction is a platform feature billed to us,
// not the tenant (the tenant's aiGeminiApiKey powers the AI advisor, a
// separate Gemini-based feature).
function resolveApiKey(): string | null {
  return process.env.ANTHROPIC_API_KEY || null;
}

export const POST = handler(async (req: Request) => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);

  const recent = await prisma.menuFileImport.findFirst({
    where: { tenantId: session.tenantId, status: "preview" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (recent && Date.now() - recent.createdAt.getTime() < PREVIEW_COOLDOWN_MS) {
    return apiError("cooldown", "המתן רגע לפני העלאת תפריט נוסף", 429);
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return apiError("no_file", "לא נבחר קובץ", 400);
  }
  const source = ALLOWED[file.type];
  if (!source) {
    return apiError("bad_type", "יש להעלות קובץ PDF או תמונה (PNG/JPG)", 415);
  }
  if (file.size > MAX_BYTES) {
    return apiError("too_large", "הקובץ גדול מדי (עד 15MB)", 413);
  }

  const apiKey = resolveApiKey();
  if (!apiKey) {
    return apiError(
      "ai_not_configured",
      "ייבוא מתפריט אינו זמין כרגע (חסר מפתח AI)",
      503,
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  let menu;
  try {
    menu = await extractMenuFromFile({ apiKey, bytes, mimeType: file.type });
  } catch (err) {
    if (err instanceof MenuExtractError) {
      return apiError(err.code, err.message || "חילוץ התפריט נכשל", 422);
    }
    throw err;
  }

  if (menu.items.length === 0) {
    return apiError("empty_menu", "לא זוהו מנות בקובץ. נסה קובץ ברור יותר.", 422);
  }

  const created = await prisma.menuFileImport.create({
    data: {
      tenantId: session.tenantId,
      source,
      status: "preview",
      fileName: file.name.slice(0, 200),
      categoriesTotal: menu.categories.length,
      itemsTotal: menu.items.length,
      extraction: menu as unknown as Prisma.InputJsonValue,
      model: MENU_IMPORT_MODEL,
    },
    select: { id: true },
  });

  return apiJson(
    {
      import_id: created.id,
      file_name: file.name,
      source,
      menu,
    },
    201,
  );
});
