import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * CSV import - expects a CSV with header row:
 *   name,description,category,base_price,prep_minutes,available,tags
 *
 * Tags can be semicolon-separated. Category is matched by name (case-insensitive);
 * if missing it gets created. The import is best-effort: any row that fails is
 * reported in the response but the rest still go through.
 *
 * The endpoint accepts either:
 *   - multipart/form-data with `file`
 *   - application/json with `{ csv: "..." }`
 */
export const POST = handler(async (req: Request) => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);

  let csv: string;
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return apiError("validation_error", "missing file", 422, "file");
    }
    csv = await file.text();
  } else {
    const body = (await req.json()) as { csv?: string };
    if (!body.csv) return apiError("validation_error", "missing csv", 422, "csv");
    csv = body.csv;
  }

  const lines = csv.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) {
    return apiError("validation_error", "ה-CSV ריק או חסר שורת כותרת", 422, "csv");
  }

  const header = parseCsvLine(lines[0]).map((s) => s.toLowerCase().trim());
  const required = ["name", "category", "base_price"];
  for (const r of required) {
    if (!header.includes(r)) {
      return apiError("validation_error", `חסרה עמודה ${r}`, 422, "csv");
    }
  }

  // Pre-fetch / create categories
  const existingCategories = await prisma.menuCategory.findMany({
    where: { tenantId: session.tenantId },
  });
  const categoryByName = new Map(
    existingCategories.map((c) => [c.name.toLowerCase().trim(), c]),
  );

  const created: string[] = [];
  const errors: Array<{ row: number; message: string }> = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    header.forEach((h, idx) => {
      row[h] = (cols[idx] ?? "").trim();
    });

    try {
      if (!row.name) throw new Error("חסר שם");
      const basePrice = parseInt(row.base_price, 10);
      if (isNaN(basePrice) || basePrice < 0) throw new Error("מחיר לא תקין");

      const catName = row.category;
      let cat = categoryByName.get(catName.toLowerCase().trim());
      if (!cat) {
        cat = await prisma.menuCategory.create({
          data: {
            tenantId: session.tenantId,
            name: catName,
            position: categoryByName.size,
          },
        });
        categoryByName.set(catName.toLowerCase().trim(), cat);
      }

      const item = await prisma.menuItem.create({
        data: {
          tenantId: session.tenantId,
          categoryId: cat.id,
          name: row.name,
          description: row.description ?? "",
          basePrice,
          prepMinutes: parseInt(row.prep_minutes ?? "10", 10) || 10,
          available: row.available?.toLowerCase() !== "false",
          tags: (row.tags ?? "")
            .split(/[;,|]/)
            .map((t) => t.trim())
            .filter(Boolean),
        },
      });
      created.push(item.id);
    } catch (e) {
      errors.push({ row: i + 1, message: (e as Error).message });
    }
  }

  return apiJson({
    created: created.length,
    errors,
  });
});

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}
