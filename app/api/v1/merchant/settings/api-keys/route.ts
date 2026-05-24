import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { mintApiKey } from "@/lib/auth/api-keys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CreateSchema = z.object({
  name: z.string().min(1).max(80),
  expires_at: z.string().datetime().nullable().optional(),
});

export const GET = handler(async () => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiJson({ api_keys: [] });
  const keys = await prisma.apiKey.findMany({
    where: { tenantId: session.tenantId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      prefix: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true,
    },
  });
  return apiJson({
    api_keys: keys.map((k) => ({
      id: k.id,
      name: k.name,
      prefix: k.prefix,
      last_used_at: k.lastUsedAt?.toISOString() ?? null,
      expires_at: k.expiresAt?.toISOString() ?? null,
      created_at: k.createdAt.toISOString(),
    })),
  });
});

export const POST = handler(async (req: Request) => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const body = CreateSchema.parse(await req.json());

  const minted = await mintApiKey();
  const created = await prisma.apiKey.create({
    data: {
      tenantId: session.tenantId,
      name: body.name,
      prefix: minted.prefix,
      hash: minted.hash,
      expiresAt: body.expires_at ? new Date(body.expires_at) : null,
    },
  });

  return apiJson(
    {
      api_key: {
        id: created.id,
        name: created.name,
        prefix: created.prefix,
        token: minted.full,
        expires_at: created.expiresAt?.toISOString() ?? null,
        created_at: created.createdAt.toISOString(),
      },
    },
    201,
  );
});
