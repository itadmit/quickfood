/**
 * Platform-admin trial extension.
 *
 *   POST → push the tenant's trial_ends_at forward by 7 or 30 days.
 *
 * The merchant dashboard gates access purely on trial_ends_at vs. now
 * (see dashboard/layout.tsx → TrialGate), so extending this date is all
 * it takes to re-open an expired trial. When the current trial is still
 * live we add the days on top of the existing end; when it has already
 * lapsed we extend from now so the merchant gets the full window.
 */
import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ days: z.union([z.literal(7), z.literal(30)]) });

const DAY_MS = 24 * 60 * 60 * 1000;

export const POST = handler(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    await requireAdmin();
    const { id } = await params;
    const { days } = Body.parse(await req.json());

    const tenant = await prisma.tenant.findUnique({
      where: { id },
      select: { id: true, trialEndsAt: true },
    });
    if (!tenant) return apiError("not_found", "מסעדה לא נמצאה", 404);

    const now = Date.now();
    const base =
      tenant.trialEndsAt && tenant.trialEndsAt.getTime() > now
        ? tenant.trialEndsAt.getTime()
        : now;
    const next = new Date(base + days * DAY_MS);

    const updated = await prisma.tenant.update({
      where: { id },
      data: { trialEndsAt: next },
      select: { id: true, trialEndsAt: true },
    });

    return apiJson({
      tenant: {
        id: updated.id,
        trial_ends_at: updated.trialEndsAt?.toISOString() ?? null,
      },
    });
  },
);
