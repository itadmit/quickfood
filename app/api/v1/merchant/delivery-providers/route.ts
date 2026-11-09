import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { DELIVERY_PROVIDERS, providerMeta, type DeliveryProviderId } from "@/lib/delivery-providers/catalog";
import { readProviderSettings } from "@/lib/delivery-providers/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function serialize(raw: unknown) {
  return DELIVERY_PROVIDERS.map((p) => {
    const s = readProviderSettings(raw, p.id);
    return {
      id: p.id,
      label: p.label,
      description: p.description,
      fields: p.fields.map((f) => ({
        key: f.key,
        label: f.label,
        secret: !!f.secret,
        placeholder: f.placeholder ?? null,
        optional: !!f.optional,
        options: f.options ?? null,
        value: f.secret ? "" : s.values[f.key],
        is_set: !!s.values[f.key],
      })),
      enabled: s.enabled,
      auto_dispatch: s.autoDispatch,
      prep_minutes: s.prepMinutes,
    };
  });
}

async function loadRaw(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { deliveryProviders: true },
  });
  const raw = tenant?.deliveryProviders;
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

export const GET = handler(async () => {
  const session = await requireMerchant();
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  return apiJson({ providers: serialize(await loadRaw(session.tenantId)) });
});

const Schema = z.object({
  provider: z.string(),
  enabled: z.boolean(),
  auto_dispatch: z.boolean(),
  prep_minutes: z.number().int().min(1).max(240),
  values: z.record(z.string(), z.string().max(500)),
});

export const PUT = handler(async (req: Request) => {
  const session = await requireMerchant();
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError("validation_error", "קלט לא תקין", 422);
  const meta = providerMeta(parsed.data.provider);
  if (!meta) return apiError("validation_error", "חברת משלוחים לא מוכרת", 422, "provider");

  const raw = await loadRaw(session.tenantId);
  const prev = readProviderSettings(raw, meta.id as DeliveryProviderId);
  const next: Record<string, unknown> = {
    enabled: parsed.data.enabled,
    autoDispatch: parsed.data.auto_dispatch,
    prepMinutes: parsed.data.prep_minutes,
  };
  for (const f of meta.fields) {
    const incoming = (parsed.data.values[f.key] ?? "").trim();
    if (f.options && incoming && !f.options.some((o) => o.value === incoming)) {
      return apiError("validation_error", `ערך לא תקין: ${f.label}`, 422, f.key);
    }
    next[f.key] = f.secret && !incoming ? prev.values[f.key] : incoming;
  }
  if (parsed.data.enabled) {
    const missing = meta.fields.find((f) => !f.optional && !next[f.key]);
    if (missing) return apiError("validation_error", `חסר: ${missing.label}`, 422, missing.key);
  }

  const merged = { ...raw, [meta.id]: next };
  await prisma.tenant.update({
    where: { id: session.tenantId },
    data: { deliveryProviders: merged as never },
  });
  return apiJson({ providers: serialize(merged) });
});
