import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { decryptSecret, maskSecret } from "@/lib/crypto/secrets";
import { SettingsHeader } from "../SettingsHeader";
import { AIAdvisorSettingsForm } from "./AIAdvisorSettingsForm";

export const dynamic = "force-dynamic";

export default async function AIAdvisorSettingsPage() {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: { aiAdvisorEnabled: true, aiGeminiApiKey: true },
  });
  if (!tenant) redirect("/dashboard/login");

  let maskedKey: string | null = null;
  if (tenant.aiGeminiApiKey) {
    try {
      maskedKey = maskSecret(decryptSecret(tenant.aiGeminiApiKey));
    } catch {
      maskedKey = "•••••";
    }
  }

  return (
    <div className="space-y-5">
      <SettingsHeader subtitle="יועץ AI ללקוחות" />
      <AIAdvisorSettingsForm
        initial={{
          enabled: tenant.aiAdvisorEnabled,
          hasKey: !!tenant.aiGeminiApiKey,
          maskedKey,
        }}
      />
    </div>
  );
}
