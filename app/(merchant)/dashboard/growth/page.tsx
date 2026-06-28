import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import {
  getDirectCustomerOverview,
  getAcquisitionFunnel,
  getSourceBreakdown,
  getQrCampaignPerformance,
  type DateRange,
} from "@/lib/growth/analytics";
import { getGrowthScore } from "@/lib/growth/score";
import { getGrowthInsights } from "@/lib/growth/insights";
import { getDailyBriefing } from "@/lib/growth/briefing";
import { generateGrowthTasks, listPendingTasks } from "@/lib/growth/tasks";
import { GrowthView } from "./GrowthView";

export const dynamic = "force-dynamic";

function monthRange(): DateRange {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  return { from, to: now };
}

export default async function GrowthPage() {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }
  const tenantId = session.tenantId;
  const range = monthRange();

  // Refresh the action queue before rendering - the screen is action-first.
  await generateGrowthTasks(tenantId);

  const [tenant, overview, funnel, sources, qr, score, insights, briefing, tasks] =
    await Promise.all([
      prisma.tenant.findUnique({ where: { id: tenantId }, select: { slug: true, name: true } }),
      getDirectCustomerOverview(tenantId, range),
      getAcquisitionFunnel(tenantId, range),
      getSourceBreakdown(tenantId, range),
      getQrCampaignPerformance(tenantId, range),
      getGrowthScore(tenantId),
      getGrowthInsights(tenantId, range),
      getDailyBriefing(tenantId),
      listPendingTasks(tenantId),
    ]);

  return (
    <GrowthView
      slug={tenant?.slug ?? ""}
      overview={overview}
      funnel={funnel}
      sources={sources}
      qr={qr}
      score={score}
      insights={insights}
      briefing={briefing}
      tasks={tasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        expectedImpact: t.expectedImpact,
        actionType: t.actionType,
        actionPayload: t.actionPayload as Record<string, unknown> | null,
      }))}
    />
  );
}
