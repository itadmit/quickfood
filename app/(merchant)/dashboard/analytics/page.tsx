import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import {
  summary,
  hourly,
  topItems,
  channelBreakdown,
  customerSegments,
  operationalHealth,
  insights,
  type Range,
} from "@/lib/analytics";
import { AnalyticsView } from "./AnalyticsView";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }

  const raw = (await searchParams).range;
  const allowed = ["today", "yesterday", "7d", "30d"] as const;
  type Quick = (typeof allowed)[number];
  // Default to 7d — short enough to surface fresh signal, long enough that
  // AOV / repeat-rate / channel breakdown all have enough data to be
  // meaningful. The dashboard home defaults to "today"; this is the
  // deeper-dive view.
  const range: Quick = allowed.includes(raw as Quick) ? (raw as Quick) : "7d";
  const apiRange: Range = range;

  const [sum, hr, items, channels, segments, ops, ins] = await Promise.all([
    summary(session.tenantId, apiRange),
    hourly(session.tenantId, apiRange),
    topItems(session.tenantId, apiRange, 8),
    channelBreakdown(session.tenantId, apiRange),
    customerSegments(session.tenantId, apiRange),
    operationalHealth(session.tenantId, apiRange),
    insights(session.tenantId, apiRange),
  ]);

  return (
    <AnalyticsView
      range={range}
      summary={sum}
      hourly={hr}
      topItems={items}
      channels={channels}
      segments={segments}
      ops={ops}
      insights={ins}
    />
  );
}
