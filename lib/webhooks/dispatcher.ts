import { prisma } from "@/lib/db/client";
import type { WebhookEventType, WebhookEnvelope } from "./events";
import { signPayload } from "./signature";

const RETRY_SCHEDULE_MIN = [1, 5, 15, 60, 360];
const MAX_ATTEMPTS = RETRY_SCHEDULE_MIN.length;
const REQUEST_TIMEOUT_MS = 8_000;

interface DispatchArgs {
  tenantId: string;
  eventType: WebhookEventType;
  payload: Record<string, unknown>;
}

/**
 * Create WebhookDelivery rows for all active endpoints subscribed to the event,
 * then attempt immediate delivery (fire-and-forget).
 *
 * Failed deliveries are picked up by the cron worker.
 */
export async function dispatchWebhook(args: DispatchArgs): Promise<void> {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: {
      tenantId: args.tenantId,
      active: true,
      events: { has: args.eventType },
    },
  });

  if (endpoints.length === 0) return;

  const deliveries = await Promise.all(
    endpoints.map((ep) =>
      prisma.webhookDelivery.create({
        data: {
          endpointId: ep.id,
          eventType: args.eventType,
          payload: args.payload as object,
          status: "pending",
          nextRetryAt: new Date(),
        },
      }),
    ),
  );

  // Attempt immediate delivery in parallel — do not await.
  for (const d of deliveries) {
    const ep = endpoints.find((e) => e.id === d.endpointId)!;
    void attemptDelivery(d.id, ep.url, ep.secret).catch(() => {
      /* error already logged in attemptDelivery */
    });
  }
}

/**
 * Worker entry — process pending/retryable deliveries.
 * Called from /api/internal/webhooks/process (QStash schedule).
 */
export async function processPending(limit = 50): Promise<{ processed: number }> {
  const due = await prisma.webhookDelivery.findMany({
    where: {
      status: { in: ["pending", "failed"] },
      nextRetryAt: { lte: new Date() },
      attempts: { lt: MAX_ATTEMPTS },
    },
    include: { endpoint: true },
    take: limit,
    orderBy: { nextRetryAt: "asc" },
  });

  let processed = 0;
  for (const d of due) {
    if (!d.endpoint.active) continue;
    await attemptDelivery(d.id, d.endpoint.url, d.endpoint.secret);
    processed++;
  }
  return { processed };
}

async function attemptDelivery(deliveryId: string, url: string, secret: string): Promise<void> {
  const delivery = await prisma.webhookDelivery.findUnique({ where: { id: deliveryId } });
  if (!delivery) return;

  const envelope: WebhookEnvelope = {
    id: delivery.id,
    event: delivery.eventType as WebhookEventType,
    created_at: delivery.createdAt.toISOString(),
    tenant_id: "", // resolved via endpoint below
    data: delivery.payload as unknown,
  };
  const endpoint = await prisma.webhookEndpoint.findUnique({
    where: { id: delivery.endpointId },
    select: { tenantId: true },
  });
  envelope.tenant_id = endpoint?.tenantId ?? "";

  const body = JSON.stringify(envelope);
  const sig = signPayload(secret, body);
  const attempt = delivery.attempts + 1;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let responseCode = 0;
  let responseBody = "";
  let success = false;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-quickfood-signature": sig.header,
        "x-quickfood-event": delivery.eventType,
        "x-quickfood-delivery": delivery.id,
      },
      body,
      signal: controller.signal,
    });
    responseCode = res.status;
    responseBody = (await res.text()).slice(0, 2000);
    success = res.ok;
  } catch (err) {
    responseBody = `fetch_error: ${(err as Error).message}`.slice(0, 2000);
  } finally {
    clearTimeout(timer);
  }

  let nextStatus: "success" | "failed" | "abandoned" = success ? "success" : "failed";
  let nextRetryAt: Date | null = null;
  if (!success && attempt >= MAX_ATTEMPTS) nextStatus = "abandoned";
  if (!success && attempt < MAX_ATTEMPTS) {
    nextRetryAt = new Date(Date.now() + RETRY_SCHEDULE_MIN[attempt - 1] * 60_000);
  }

  await prisma.webhookDelivery.update({
    where: { id: delivery.id },
    data: {
      attempts: attempt,
      lastAttemptAt: new Date(),
      nextRetryAt,
      status: nextStatus,
      responseCode: responseCode || null,
      responseBody,
    },
  });
}
