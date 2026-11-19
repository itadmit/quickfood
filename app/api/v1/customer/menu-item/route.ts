import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { loadMenuItemForCustomer } from "@/lib/menu-item-load";
import { resolveTenantBySlug } from "@/lib/slug";
import { LANG_COOKIE, resolveLang } from "@/lib/i18n/langs";
import { localizeMenuItem } from "@/lib/i18n/localize-item";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug") ?? "";
  const id = searchParams.get("id") ?? "";
  if (!slug || !id)
    return NextResponse.json({ error: "missing params" }, { status: 400 });
  const loaded = await loadMenuItemForCustomer(slug, id);
  if (!loaded)
    return NextResponse.json({ error: "not found" }, { status: 404 });
  const requested = (await cookies()).get(LANG_COOKIE)?.value;
  if (requested && requested !== "he") {
    const tenant = await resolveTenantBySlug(slug);
    const lang = resolveLang(requested, tenant?.storefrontLanguages ?? ["he"]);
    if (tenant && lang !== "he") {
      const item = await localizeMenuItem(tenant.id, lang, loaded.item);
      return NextResponse.json({ ...loaded, item });
    }
  }
  return NextResponse.json(loaded);
}
