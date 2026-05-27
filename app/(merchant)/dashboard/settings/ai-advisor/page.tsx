import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { decryptSecret, maskSecret } from "@/lib/crypto/secrets";
import { SettingsHeader } from "../SettingsHeader";
import { AIAdvisorSettingsForm } from "./AIAdvisorSettingsForm";

export const dynamic = "force-dynamic";

function maskedFor(enc: string | null): string | null {
  if (!enc) return null;
  try {
    return maskSecret(decryptSecret(enc));
  } catch {
    return "•••••";
  }
}

export default async function AIAdvisorSettingsPage() {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: {
      aiAdvisorEnabled: true,
      aiProvider: true,
      aiGeminiApiKey: true,
      aiClaudeApiKey: true,
    },
  });
  if (!tenant) redirect("/dashboard/login");

  return (
    <div className="space-y-5">
      <SettingsHeader subtitle="יועץ AI ללקוחות" />
      <AIAdvisorSettingsForm
        initial={{
          enabled: tenant.aiAdvisorEnabled,
          provider: tenant.aiProvider,
          gemini: {
            hasKey: !!tenant.aiGeminiApiKey,
            maskedKey: maskedFor(tenant.aiGeminiApiKey),
          },
          claude: {
            hasKey: !!tenant.aiClaudeApiKey,
            maskedKey: maskedFor(tenant.aiClaudeApiKey),
          },
        }}
      />
    </div>
  );
}
