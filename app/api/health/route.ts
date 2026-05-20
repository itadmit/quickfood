import { apiJson } from "@/lib/api-response";

export const runtime = "nodejs";

export async function GET() {
  return apiJson({
    ok: true,
    name: "quickfood",
    version: "0.1.0",
    time: new Date().toISOString(),
  });
}
