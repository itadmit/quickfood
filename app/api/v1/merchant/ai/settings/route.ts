import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { encryptSecret, decryptSecret, maskSecret } from "@/lib/crypto/secrets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  enabled: z.boolean().optional(),
  api_key: z.string().trim().max(500).nullable().optional(),
});

function describe(row: { aiAdvisorEnabled: boolean; aiGeminiApiKey: string | null }) {
  let masked: string | null = null;
  if (row.aiGeminiApiKey) {
    try {
      masked = maskSecret(decryptSecret(row.aiGeminiApiKey));
    } catch {
      masked = "•••••";
    }
  }
  return {
    enabled: row.aiAdvisorEnabled,
    has_key: !!row.aiGeminiApiKey,
    masked_key: masked,
  };
}

export const GET = handler(async () => {
  const session = await requireMerchant();
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const t = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: { aiAdvisorEnabled: true, aiGeminiApiKey: true },
  });
  if (!t) return apiError("not_found", "tenant not found", 404);
  return apiJson({ settings: describe(t) });
});

export const PATCH = handler(async (req: Request) => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const body = Schema.parse(await req.json());

  const data: { aiAdvisorEnabled?: boolean; aiGeminiApiKey?: string | null } = {};
  if (body.enabled !== undefined) data.aiAdvisorEnabled = body.enabled;
  if (body.api_key !== undefined) {
    if (body.api_key === null || body.api_key === "") {
      data.aiGeminiApiKey = null;
      data.aiAdvisorEnabled = false;
    } else {
      data.aiGeminiApiKey = encryptSecret(body.api_key);
    }
  }

  if (data.aiAdvisorEnabled === true) {
    const current = await prisma.tenant.findUnique({
      where: { id: session.tenantId },
      select: { aiGeminiApiKey: true },
    });
    const hasKey = data.aiGeminiApiKey ?? current?.aiGeminiApiKey;
    if (!hasKey) {
      return apiError("missing_key", "אי אפשר להפעיל ללא מפתח Gemini", 400);
    }
  }

  const updated = await prisma.tenant.update({
    where: { id: session.tenantId },
    data,
    select: { aiAdvisorEnabled: true, aiGeminiApiKey: true },
  });
  return apiJson({ settings: describe(updated) });
});
