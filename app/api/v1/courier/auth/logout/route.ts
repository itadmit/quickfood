import { handler, apiJson } from "@/lib/api-response";
import {
  getCourierSession,
  clearCourierCookie,
  revokeCourierSession,
} from "@/lib/auth/courier-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async () => {
  const session = await getCourierSession();
  if (session) await revokeCourierSession(session.sessionId);
  await clearCourierCookie();
  return apiJson({ ok: true });
});
