/**
 * Delivery-status webhook from sms4free.
 *
 * The provider calls our configured URL with `to` and `status` as URL query
 * params. Status codes:
 *   1 = delivered
 *   5 = not delivered
 *   6 = invalid recipient number
 *
 * Since we don't get a message-id back from the provider, we match on the
 * most recent `sent`/`pending` SmsLog for that recipient. Best-effort.
 */
import { handler, apiJson, apiError } from "@/lib/api-response";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(req: Request) {
  const url = new URL(req.url);
  const to = url.searchParams.get("to")?.replace(/[^\d]/g, "");
  const statusCode = parseInt(url.searchParams.get("status") ?? "0", 10);
  if (!to || !statusCode) return apiError("bad_request", "missing to/status", 400);

  const log = await prisma.smsLog.findFirst({
    where: { to, status: "sent" },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!log) return apiJson({ ok: true, matched: false });

  const newStatus =
    statusCode === 1
      ? "delivered"
      : statusCode === 6
        ? "invalid_recipient"
        : "failed";

  await prisma.smsLog.update({
    where: { id: log.id },
    data: {
      status: newStatus,
      providerCode: statusCode,
      ...(statusCode === 1 ? { deliveredAt: new Date() } : {}),
    },
  });
  return apiJson({ ok: true, matched: true, status: newStatus });
}

// sms4free spec doesn't pin a method - accept both.
export const POST = handler(handle);
export const GET = handler(handle);
