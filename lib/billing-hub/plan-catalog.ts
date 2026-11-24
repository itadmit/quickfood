/**
 * Local catalog row for the zero-commission plan, and the hub's id for it.
 *
 * The hub's renewal webhook (`subscription.updated` after a scheduled plan
 * change) carries only `new_plan_id`, not the plan code. We keep the hub id
 * of quickfood_no_commission on the local row (features.hubPlanId), learned
 * from the PATCH response or from `subscription.created`.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import {
  NO_COMMISSION_PLAN_CODE,
  NO_COMMISSION_PLAN_ID,
  NO_COMMISSION_PLAN_PRICE,
  type PlatformPlan,
} from "./plans";

type Features = Record<string, unknown>;

function baseFeatures(): Features {
  return { commission: 0, planCode: NO_COMMISSION_PLAN_CODE, pretaxPrice: true };
}

/** Make sure the `plans` row exists before pointing Tenant.planId at it. */
export async function ensureNoCommissionPlanRow(): Promise<void> {
  await prisma.plan.upsert({
    where: { id: NO_COMMISSION_PLAN_ID },
    create: {
      id: NO_COMMISSION_PLAN_ID,
      name: "ללא עמלות",
      priceMonthly: NO_COMMISSION_PLAN_PRICE,
      features: baseFeatures() as Prisma.InputJsonValue,
    },
    update: {},
  });
}

export async function getNoCommissionHubPlanId(): Promise<string | null> {
  const row = await prisma.plan.findUnique({
    where: { id: NO_COMMISSION_PLAN_ID },
    select: { features: true },
  });
  const f = (row?.features ?? {}) as Features;
  return typeof f.hubPlanId === "string" ? f.hubPlanId : null;
}

export async function rememberNoCommissionHubPlanId(hubPlanId: string): Promise<void> {
  await ensureNoCommissionPlanRow();
  const row = await prisma.plan.findUnique({
    where: { id: NO_COMMISSION_PLAN_ID },
    select: { features: true },
  });
  const f = (row?.features ?? {}) as Features;
  if (f.hubPlanId === hubPlanId) return;
  await prisma.plan.update({
    where: { id: NO_COMMISSION_PLAN_ID },
    data: { features: { ...baseFeatures(), ...f, hubPlanId } as Prisma.InputJsonValue },
  });
}

/**
 * Point the tenant at the chosen platform plan. Base clears the planId only
 * when it was the zero-commission row, so legacy rows are left alone.
 */
export async function setTenantPlatformPlan(
  tenant: { id: string; planId: string | null },
  plan: PlatformPlan,
): Promise<void> {
  if (plan === "no_commission") {
    if (tenant.planId === NO_COMMISSION_PLAN_ID) return;
    await ensureNoCommissionPlanRow();
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { planId: NO_COMMISSION_PLAN_ID },
    });
  } else if (tenant.planId === NO_COMMISSION_PLAN_ID) {
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { planId: null },
    });
  }
}
