import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { setTaskStatus } from "@/lib/growth/tasks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ status: z.enum(["completed", "dismissed", "pending"]) });

export const POST = handler(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireMerchant(["owner", "manager"]);
    if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
    const { id } = await params;
    const { status } = Body.parse(await req.json());
    const task = await setTaskStatus(session.tenantId, id, status);
    if (!task) return apiError("not_found", "task not found", 404);
    return apiJson({ task });
  },
);
