import { handler, apiJson } from "@/lib/api-response";
import { prisma } from "@/lib/db/client";
import { isValidSlug } from "@/lib/slug";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RESERVED = new Set([
  "admin",
  "dashboard",
  "api",
  "signup",
  "login",
  "about",
  "pricing",
  "support",
  "help",
  "docs",
  "www",
  "app",
  "auth",
  "pay",
  "_next",
]);

export const GET = handler(async (req: Request) => {
  const q = new URL(req.url).searchParams.get("slug")?.toLowerCase().trim() ?? "";

  if (!q || q.length < 2) {
    return apiJson({ slug: q, status: "too_short", available: false });
  }
  if (!isValidSlug(q)) {
    return apiJson({ slug: q, status: "invalid", available: false });
  }
  if (RESERVED.has(q)) {
    return apiJson({ slug: q, status: "reserved", available: false });
  }
  const exists = await prisma.tenant.findUnique({ where: { slug: q }, select: { id: true } });
  if (exists) {
    return apiJson({ slug: q, status: "taken", available: false });
  }
  return apiJson({ slug: q, status: "available", available: true });
});
