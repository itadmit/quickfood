import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import type { Prisma } from "@prisma/client";
import { loadLoyaltyData } from "@/lib/loyalty/members";
import { resolveLoyaltyConfig } from "@/lib/loyalty/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TierSchema = z.object({
  name: z.string().min(1).max(40),
  minPoints: z.number().int().min(0).max(1_000_000),
});

const LoyaltyConfigSchema = z.object({
  pointsPerShekel: z.number().min(0).max(100),
  earnPerShekel: z.object({
    silver: z.number().min(0).max(100),
    gold: z.number().min(0).max(100),
    platinum: z.number().min(0).max(100),
  }),
  redemption: z.object({
    enabled: z.boolean(),
    pointValueAgorot: z.number().int().min(1).max(10_000),
    maxPercentOfOrder: z.number().int().min(1).max(100),
    minPoints: z.number().int().min(0).max(1_000_000),
  }),
  tiers: z.object({
    silver: TierSchema,
    gold: TierSchema,
    platinum: TierSchema,
  }),
  showJoinPopup: z.boolean(),
  popupShowOnce: z.boolean(),
  showCheckoutCheckbox: z.boolean(),
  joinForm: z.object({
    title: z.string().min(1).max(120),
    subtitle: z.string().max(280),
    buttonText: z.string().min(1).max(60),
    imageUrl: z.string().max(2000).nullable(),
    collectName: z.boolean(),
    collectEmail: z.boolean(),
    collectBirthday: z.boolean(),
    consentText: z.string().min(1).max(400),
  }),
  checkoutConsentText: z.string().min(1).max(400),
  birthdayBenefit: z.boolean(),
  birthdayDiscountPercent: z.number().int().min(1).max(100),
  birthdayGreeting: z.string().min(1).max(800),
});

export const GET = handler(async () => {
  const session = await requireMerchant();
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: { name: true },
  });
  const data = await loadLoyaltyData(session.tenantId, tenant?.name ?? "העסק");
  return apiJson(data);
});

export const PATCH = handler(async (req: Request) => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const raw = LoyaltyConfigSchema.parse(await req.json());
  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: { name: true },
  });
  // Re-normalize through the resolver so what we store is always a complete,
  // canonical config object (no partials, no stray keys).
  const config = resolveLoyaltyConfig(raw, tenant?.name ?? "העסק");
  await prisma.tenant.update({
    where: { id: session.tenantId },
    data: { loyaltyConfig: config as unknown as Prisma.InputJsonObject },
  });
  return apiJson({ config });
});
