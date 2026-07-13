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
  visitorStats,
  parseCustomBounds,
  type Range,
} from "@/lib/analytics";
import { AnalyticsView } from "./AnalyticsView";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }

  const params = await searchParams;
  const allowed = [
    "today",
    "yesterday",
    "7d",
    "30d",
    "this_month",
    "last_month",
    "custom",
  ] as const;
  type Quick = (typeof allowed)[number];

  const custom =
    params.range === "custom" ? parseCustomBounds(params.from, params.to) : null;

  // Default to 7d - short enough to surface fresh signal, long enough that
  // AOV / repeat-rate / channel breakdown all have enough data to be
  // meaningful. The dashboard home defaults to "today"; this is the
  // deeper-dive view. A custom range with unparsable dates also lands here.
  const range: Quick =
    params.range === "custom"
      ? custom
        ? "custom"
        : "7d"
      : allowed.includes(params.range as Quick)
        ? (params.range as Quick)
        : "7d";
  const apiRange: Range = range;
  const bounds = custom ?? undefined;

  const [sum, hr, items, channels, segments, ops, ins, visitors] = await Promise.all([
    summary(session.tenantId, apiRange, bounds),
    hourly(session.tenantId, apiRange, bounds),
    topItems(session.tenantId, apiRange, 8, bounds),
    channelBreakdown(session.tenantId, apiRange, bounds),
    customerSegments(session.tenantId, apiRange, bounds),
    operationalHealth(session.tenantId, apiRange, bounds),
    insights(session.tenantId, apiRange, bounds),
    visitorStats(session.tenantId, apiRange, bounds),
  ]);

  return (
    <AnalyticsView
      range={range}
      customFrom={range === "custom" ? (params.from ?? null) : null}
      customTo={range === "custom" ? (params.to ?? null) : null}
      summary={sum}
      hourly={hr}
      topItems={items}
      channels={channels}
      segments={segments}
      ops={ops}
      insights={ins}
      visitors={visitors}
    />
  );
}
