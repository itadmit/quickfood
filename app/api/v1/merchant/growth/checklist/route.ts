import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { completeChecklistItem } from "@/lib/growth/tasks";
import { getGrowthScore } from "@/lib/growth/score";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  key: z.string().min(1).max(60),
  title: z.string().min(1).max(160),
  done: z.boolean().default(true),
});

export const POST = handler(async (req: Request) => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const { key, title, done } = Body.parse(await req.json());

  if (done) {
    await completeChecklistItem(session.tenantId, key, title);
  } else {
    await prisma.growthTask.updateMany({
      where: { tenantId: session.tenantId, key },
      data: { status: "pending", completedAt: null },
    });
  }

  const score = await getGrowthScore(session.tenantId);
  return apiJson({ score });
});
