import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { encryptSecret, decryptSecret, maskSecret } from "@/lib/crypto/secrets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  enabled: z.boolean().optional(),
  popup_enabled: z.boolean().optional(),
  provider: z.enum(["gemini", "claude"]).optional(),
  gemini_api_key: z.string().trim().max(500).nullable().optional(),
  claude_api_key: z.string().trim().max(500).nullable().optional(),
});

function describe(row: {
  aiAdvisorEnabled: boolean;
  aiAdvisorPopupEnabled: boolean;
  aiProvider: "gemini" | "claude";
  aiGeminiApiKey: string | null;
  aiClaudeApiKey: string | null;
}) {
  const maskedFor = (enc: string | null): string | null => {
    if (!enc) return null;
    try {
      return maskSecret(decryptSecret(enc));
    } catch {
      return "•••••";
    }
  };
  return {
    enabled: row.aiAdvisorEnabled,
    popup_enabled: row.aiAdvisorPopupEnabled,
    provider: row.aiProvider,
    gemini: {
      has_key: !!row.aiGeminiApiKey,
      masked_key: maskedFor(row.aiGeminiApiKey),
    },
    claude: {
      has_key: !!row.aiClaudeApiKey,
      masked_key: maskedFor(row.aiClaudeApiKey),
    },
  };
}

export const GET = handler(async () => {
  const session = await requireMerchant();
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const t = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: {
      aiAdvisorEnabled: true,
      aiAdvisorPopupEnabled: true,
      aiProvider: true,
      aiGeminiApiKey: true,
      aiClaudeApiKey: true,
    },
  });
  if (!t) return apiError("not_found", "tenant not found", 404);
  return apiJson({ settings: describe(t) });
});

export const PATCH = handler(async (req: Request) => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const body = Schema.parse(await req.json());

  const data: {
    aiAdvisorEnabled?: boolean;
    aiAdvisorPopupEnabled?: boolean;
    aiProvider?: "gemini" | "claude";
    aiGeminiApiKey?: string | null;
    aiClaudeApiKey?: string | null;
  } = {};

  if (body.enabled !== undefined) data.aiAdvisorEnabled = body.enabled;
  if (body.popup_enabled !== undefined) data.aiAdvisorPopupEnabled = body.popup_enabled;
  if (body.provider !== undefined) data.aiProvider = body.provider;

  if (body.gemini_api_key !== undefined) {
    data.aiGeminiApiKey =
      body.gemini_api_key === null || body.gemini_api_key === ""
        ? null
        : encryptSecret(body.gemini_api_key);
  }
  if (body.claude_api_key !== undefined) {
    data.aiClaudeApiKey =
      body.claude_api_key === null || body.claude_api_key === ""
        ? null
        : encryptSecret(body.claude_api_key);
  }

  if (data.aiAdvisorEnabled === true) {
    const current = await prisma.tenant.findUnique({
      where: { id: session.tenantId },
      select: {
        aiGeminiApiKey: true,
        aiClaudeApiKey: true,
        aiProvider: true,
      },
    });
    const provider = data.aiProvider ?? current?.aiProvider ?? "gemini";
    const nextGemini =
      data.aiGeminiApiKey !== undefined ? data.aiGeminiApiKey : current?.aiGeminiApiKey;
    const nextClaude =
      data.aiClaudeApiKey !== undefined ? data.aiClaudeApiKey : current?.aiClaudeApiKey;
    const keyForProvider = provider === "claude" ? nextClaude : nextGemini;
    if (!keyForProvider) {
      return apiError(
        "missing_key",
        `אי אפשר להפעיל ללא מפתח עבור ${provider === "claude" ? "Claude" : "Gemini"}`,
        400,
      );
    }
  }

  // If a user clears the active provider's key, auto-disable the advisor.
  if (
    (data.aiGeminiApiKey === null || data.aiClaudeApiKey === null) &&
    data.aiAdvisorEnabled === undefined
  ) {
    const current = await prisma.tenant.findUnique({
      where: { id: session.tenantId },
      select: { aiProvider: true, aiGeminiApiKey: true, aiClaudeApiKey: true },
    });
    const provider = data.aiProvider ?? current?.aiProvider ?? "gemini";
    const stillHasKey =
      provider === "claude"
        ? data.aiClaudeApiKey !== null && (data.aiClaudeApiKey ?? current?.aiClaudeApiKey)
        : data.aiGeminiApiKey !== null && (data.aiGeminiApiKey ?? current?.aiGeminiApiKey);
    if (!stillHasKey) data.aiAdvisorEnabled = false;
  }

  const updated = await prisma.tenant.update({
    where: { id: session.tenantId },
    data,
    select: {
      aiAdvisorEnabled: true,
      aiAdvisorPopupEnabled: true,
      aiProvider: true,
      aiGeminiApiKey: true,
      aiClaudeApiKey: true,
    },
  });
  return apiJson({ settings: describe(updated) });
});
