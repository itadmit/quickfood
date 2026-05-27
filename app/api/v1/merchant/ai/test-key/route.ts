import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { decryptSecret } from "@/lib/crypto/secrets";
import { pingAdvisor } from "@/lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  provider: z.enum(["gemini", "claude"]),
  api_key: z.string().trim().min(10).max(500).optional(),
});

export const POST = handler(async (req: Request) => {
  const session = await requireMerchant();
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);

  const body = Schema.parse(await req.json().catch(() => ({})));

  let key = body.api_key;
  if (!key) {
    const t = await prisma.tenant.findUnique({
      where: { id: session.tenantId },
      select: { aiGeminiApiKey: true, aiClaudeApiKey: true },
    });
    const enc = body.provider === "claude" ? t?.aiClaudeApiKey : t?.aiGeminiApiKey;
    if (!enc) return apiError("missing_key", "אין מפתח שמור לספק זה", 400);
    try {
      key = decryptSecret(enc);
    } catch {
      return apiError("ai_misconfigured", "המפתח השמור פגום, הזן מחדש", 500);
    }
  }

  const res = await pingAdvisor(body.provider, key);
  if (!res.ok) return apiError("invalid_key", res.error || "המפתח לא תקין", 400);
  return apiJson({ ok: true });
});
