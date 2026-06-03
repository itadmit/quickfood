import { z } from "zod";
import bcrypt from "bcryptjs";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROLE_VALUES = ["owner", "manager", "kitchen", "courier_dispatch"] as const;

const PatchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  role: z.enum(ROLE_VALUES).optional(),
  password: z.string().min(8).max(120).optional(),
});

export const PATCH = handler(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireMerchant(["owner"]);
    if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
    const { id } = await params;
    const body = PatchSchema.parse(await req.json());

    const target = await prisma.merchantUser.findUnique({
      where: { id },
      select: { id: true, tenantId: true, role: true },
    });
    if (!target || target.tenantId !== session.tenantId) {
      return apiError("not_found", "משתמש לא נמצא", 404);
    }
    if (target.id === session.userId && body.role && body.role !== "owner") {
      return apiError("forbidden", "אי אפשר להחליף לעצמך את התפקיד", 403);
    }
    if (target.role === "owner" && body.role && body.role !== "owner") {
      const ownerCount = await prisma.merchantUser.count({
        where: { tenantId: session.tenantId, role: "owner" },
      });
      if (ownerCount <= 1) {
        return apiError("forbidden", "חייב להישאר לפחות בעלים אחד", 403);
      }
    }

    const updated = await prisma.merchantUser.update({
      where: { id },
      data: {
        name: body.name,
        role: body.role,
        passwordHash: body.password
          ? await bcrypt.hash(body.password, 10)
          : undefined,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });
    return apiJson({
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        role: updated.role,
        last_login_at: updated.lastLoginAt?.toISOString() ?? null,
        created_at: updated.createdAt.toISOString(),
        is_me: updated.id === session.userId,
      },
    });
  },
);

export const DELETE = handler(
  async (_req, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireMerchant(["owner"]);
    if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
    const { id } = await params;

    const target = await prisma.merchantUser.findUnique({
      where: { id },
      select: { id: true, tenantId: true, role: true },
    });
    if (!target || target.tenantId !== session.tenantId) {
      return apiError("not_found", "משתמש לא נמצא", 404);
    }
    if (target.id === session.userId) {
      return apiError("forbidden", "אי אפשר למחוק את עצמך", 403);
    }
    if (target.role === "owner") {
      const ownerCount = await prisma.merchantUser.count({
        where: { tenantId: session.tenantId, role: "owner" },
      });
      if (ownerCount <= 1) {
        return apiError("forbidden", "חייב להישאר לפחות בעלים אחד", 403);
      }
    }

    await prisma.merchantUser.delete({ where: { id } });
    return apiJson({ ok: true });
  },
);
