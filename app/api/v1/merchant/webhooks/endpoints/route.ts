import { handler, apiJson } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { WebhookEndpointInputSchema } from "@/lib/validate";
import { newWebhookSecret } from "@/lib/webhooks/signature";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const session = await requireMerchant();
  if (!session.tenantId) return apiJson({ endpoints: [] });
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { tenantId: session.tenantId },
    orderBy: { createdAt: "desc" },
  });
  return apiJson({
    endpoints: endpoints.map((e) => ({
      id: e.id,
      url: e.url,
      events: e.events,
      active: e.active,
      created_at: e.createdAt.toISOString(),
      // secret is intentionally NOT returned - it's shown only once on create
    })),
  });
});

export const POST = handler(async (req: Request) => {
  const session = await requireMerchant();
  if (!session.tenantId) return apiJson({ endpoint: null }, 422);
  const body = WebhookEndpointInputSchema.parse(await req.json());
  const secret = newWebhookSecret();
  const endpoint = await prisma.webhookEndpoint.create({
    data: {
      tenantId: session.tenantId,
      url: body.url,
      events: body.events,
      active: body.active,
      secret,
    },
  });
  return apiJson(
    {
      endpoint: {
        id: endpoint.id,
        url: endpoint.url,
        events: endpoint.events,
        active: endpoint.active,
        secret, // shown ONCE
        created_at: endpoint.createdAt.toISOString(),
      },
    },
    201,
  );
});
