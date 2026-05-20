import { handler, apiEmpty } from "@/lib/api-response";
import { clearSessionCookies } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async () => {
  await clearSessionCookies();
  return apiEmpty(204);
});
