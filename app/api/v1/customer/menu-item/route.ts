import { NextResponse } from "next/server";
import { loadMenuItemForCustomer } from "@/lib/menu-item-load";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug") ?? "";
  const id = searchParams.get("id") ?? "";
  if (!slug || !id)
    return NextResponse.json({ error: "missing params" }, { status: 400 });
  const loaded = await loadMenuItemForCustomer(slug, id);
  if (!loaded)
    return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(loaded);
}
