/**
 * Merchant DelivApp dispatch integration settings.
 *
 * GET   → current config (apiKey masked) + the inbound webhook URL to paste
 *         into DelivApp's dashboard + a `connected` boolean.
 * PATCH → update enabled / restId / appId / apiKey. An `inboundToken` is minted
 *         automatically on first save and never rotated unless explicitly reset.
 *
 * Bring-your-own credentials: each merchant creates a DelivApp integration and
 * pastes their RestID + Integration ID + API Key here. The platform hosts no
 * shared DelivApp account. Every delivery order this store accepts is then
 * mirrored into DelivApp in addition to the QuickFood dashboard.
 */
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { resolveDelivAppConfig } from "@/lib/delivapp/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  enabled: z.boolean().optional(),
  restId: z.string().trim().max(200).optional(),
  appId: z.string().trim().max(200).optional(),
  apiKey: z.string().trim().max(2000).optional(),
});

function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "https://app.quickfood.co.il"
  );
}

function webhookUrl(token: string): string {
  return `${appBaseUrl()}/api/v1/integrations/delivapp/callback?token=${token}`;
}

function readRaw(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

export const GET = handler(async () => {
  const session = await requireMerchant();
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const t = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: { delivAppConfig: true },
  });
  if (!t) return apiError("not_found", "tenant not found", 404);

  const raw = readRaw(t.delivAppConfig);
  const token = typeof raw.inboundToken === "string" ? raw.inboundToken : "";
  const apiKey = typeof raw.apiKey === "string" ? raw.apiKey : "";

  return apiJson({
    settings: {
      enabled: raw.enabled === true,
      restId: typeof raw.restId === "string" ? raw.restId : "",
      appId: typeof raw.appId === "string" ? raw.appId : "",
      apiKeySet: apiKey.length > 0,
      webhookUrl: token ? webhookUrl(token) : null,
      connected: !!resolveDelivAppConfig(t.delivAppConfig),
    },
  });
});

export const PATCH = handler(async (req: Request) => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const body = Schema.parse(await req.json());

  const current = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: { delivAppConfig: true },
  });
  if (!current) return apiError("not_found", "tenant not found", 404);

  const raw = readRaw(current.delivAppConfig);
  const next: Record<string, unknown> = { ...raw };

  if (body.enabled !== undefined) next.enabled = body.enabled;
  if (body.restId !== undefined) next.restId = body.restId;
  if (body.appId !== undefined) next.appId = body.appId;
  // Empty apiKey means "leave unchanged" so the masked field doesn't wipe the
  // stored secret on a plain toggle save.
  if (body.apiKey !== undefined && body.apiKey !== "") next.apiKey = body.apiKey;

  // Mint the inbound webhook token once, on first save.
  if (typeof next.inboundToken !== "string" || !next.inboundToken) {
    next.inboundToken = randomUUID().replace(/-/g, "");
  }

  const updated = await prisma.tenant.update({
    where: { id: session.tenantId },
    data: { delivAppConfig: next as object },
    select: { delivAppConfig: true },
  });

  const savedRaw = readRaw(updated.delivAppConfig);
  const token =
    typeof savedRaw.inboundToken === "string" ? savedRaw.inboundToken : "";
  const apiKey = typeof savedRaw.apiKey === "string" ? savedRaw.apiKey : "";

  return apiJson({
    settings: {
      enabled: savedRaw.enabled === true,
      restId: typeof savedRaw.restId === "string" ? savedRaw.restId : "",
      appId: typeof savedRaw.appId === "string" ? savedRaw.appId : "",
      apiKeySet: apiKey.length > 0,
      webhookUrl: token ? webhookUrl(token) : null,
      connected: !!resolveDelivAppConfig(updated.delivAppConfig),
    },
  });
});
