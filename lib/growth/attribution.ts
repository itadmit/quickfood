import { prisma } from "@/lib/db/client";
import { Prisma, type FirstTouchType } from "@prisma/client";
import { categoryForSource } from "./sources";

export interface RecordAttributionInput {
  tenantId: string;
  source: string;
  sourceLabel?: string;
  firstTouchType: FirstTouchType;
  customerId?: string | null;
  orderId?: string | null;
  campaignId?: string | null;
  // Trusted QR arrivals pass selfReported=false; customer answers default true.
  selfReported?: boolean;
  metadata?: Record<string, unknown> | null;
}

/**
 * Records one attribution event (a "how did you hear about us" answer or a
 * tracked QR arrival). De-dupes per customer: if the customer already has a
 * first-touch on record we DON'T overwrite it - first touch is sticky, so a
 * later self-reported answer never clobbers an earlier trusted QR source.
 */
export async function recordAttribution(input: RecordAttributionInput) {
  if (input.customerId) {
    const existing = await prisma.customerAttribution.findFirst({
      where: { tenantId: input.tenantId, customerId: input.customerId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (existing) return existing;
  }

  const category = await categoryForSource(input.tenantId, input.source);
  let label = input.sourceLabel;
  if (!label) {
    const row = await prisma.sourceSetting.findUnique({
      where: { tenantId_sourceKey: { tenantId: input.tenantId, sourceKey: input.source } },
      select: { sourceLabel: true },
    });
    label = row?.sourceLabel ?? input.source;
  }

  return prisma.customerAttribution.create({
    data: {
      tenantId: input.tenantId,
      customerId: input.customerId ?? null,
      orderId: input.orderId ?? null,
      campaignId: input.campaignId ?? null,
      source: input.source,
      sourceLabel: label,
      sourceCategory: category,
      firstTouchType: input.firstTouchType,
      selfReported: input.selfReported ?? true,
      metadata: input.metadata ? (input.metadata as Prisma.InputJsonValue) : undefined,
    },
  });
}

/** Backfill orderId onto a customer's first-touch row once they convert. */
export async function linkAttributionToOrder(
  tenantId: string,
  customerId: string,
  orderId: string,
) {
  const first = await prisma.customerAttribution.findFirst({
    where: { tenantId, customerId, orderId: null },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (first) {
    await prisma.customerAttribution.update({
      where: { id: first.id },
      data: { orderId },
    });
  }
}
