import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { summary, hourly, topItems, type Range } from "@/lib/analytics";
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
  const range: Quick = allowed.includes(raw as Quick) ? (raw as Quick) : "today";
  const apiRange: Range = range;

  const [sum, hr, items] = await Promise.all([
    summary(session.tenantId, apiRange),
    hourly(session.tenantId, apiRange),
    topItems(session.tenantId, apiRange, 5),
  ]);

  return <AnalyticsView range={range} summary={sum} hourly={hr} topItems={items} />;
}
