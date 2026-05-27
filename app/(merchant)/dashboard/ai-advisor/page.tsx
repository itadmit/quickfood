import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { decryptSecret, maskSecret } from "@/lib/crypto/secrets";
import { AIAdvisorForm } from "./AIAdvisorForm";

export const dynamic = "force-dynamic";

function maskedFor(enc: string | null): string | null {
  if (!enc) return null;
  try {
    return maskSecret(decryptSecret(enc));
  } catch {
    return "•••••";
  }
}

export default async function AIAdvisorPage() {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: {
      aiAdvisorEnabled: true,
      aiAdvisorPopupEnabled: true,
      aiAdvisorSuggestions: true,
      aiProvider: true,
      aiGeminiApiKey: true,
      aiClaudeApiKey: true,
    },
  });
  if (!tenant) redirect("/dashboard/login");

  return (
    <div className="space-y-5">
      <section className="rounded-3xl overflow-hidden border-2 border-black shadow-[0_3px_0_#000]">
        <div
          className="relative p-5 lg:p-7"
          style={{ backgroundColor: "#F8CB1E" }}
        >
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.05]"
            style={{
              backgroundImage:
                "radial-gradient(circle, #000 1px, transparent 1px)",
              backgroundSize: "22px 22px",
            }}
            aria-hidden
          />
          <div className="relative">
            <div className="inline-flex items-center gap-2 mb-2.5 text-black/70 text-xs font-semibold">
              <span className="bg-black text-[#F8CB1E] px-2 py-0.5 rounded-md text-[10px] font-black tracking-wide">
                שיווק
              </span>
              <span>יועץ-קניות חכם ללקוחות שלך</span>
            </div>
            <h1 className="text-black font-black text-3xl lg:text-4xl leading-[1.1]">
              יועץ AI
            </h1>
          </div>
        </div>
      </section>

      <AIAdvisorForm
        initial={{
          enabled: tenant.aiAdvisorEnabled,
          popupEnabled: tenant.aiAdvisorPopupEnabled,
          suggestions: tenant.aiAdvisorSuggestions,
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
