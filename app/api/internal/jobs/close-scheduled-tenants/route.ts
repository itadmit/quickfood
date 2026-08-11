/**
 * QStash-invoked daily job: close tenants whose scheduled close date has passed.
 *
 * "עצור מנוי וסגור" cancels the base subscription at period end and stamps
 * `scheduledCloseAt` with that date, leaving the store open in the meantime.
 * This job flips such tenants to `suspended` once the date arrives (so the
 * storefront closes) and clears the field. An admin re-activating the tenant
 * clears `scheduledCloseAt` first, so a re-opened store is never re-closed.
 *
 * Registered in scripts/register-qstash-schedules.ts (daily). Failures leave
 * the row untouched, so the next daily fire retries.
 */
import { handler, apiJson, apiError } from "@/lib/api-response";
import { verifySignature } from "@/lib/qstash/client";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async (req: Request) => {
  const rawBody = await req.text();
  const ok = await verifySignature(req, rawBody);
  if (!ok) {
    return apiError("unauthorized", "invalid qstash signature", 401);
  }

  const due = await prisma.tenant.findMany({
    where: {
      scheduledCloseAt: { lte: new Date() },
      status: { not: "suspended" },
    },
    select: { id: true, name: true },
  });

  const results: Array<{ tenant_id: string; status: string }> = [];
  for (const t of due) {
    try {
      await prisma.tenant.update({
        where: { id: t.id },
        data: { status: "suspended", scheduledCloseAt: null },
      });
      results.push({ tenant_id: t.id, status: "closed" });
    } catch (err) {
      console.error(`[close-scheduled-tenants] ${t.name} (${t.id}) failed:`, err);
      results.push({ tenant_id: t.id, status: "failed" });
    }
  }

  return apiJson({ ok: true, processed: results.length, results });
});
