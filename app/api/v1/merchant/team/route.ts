import { z } from "zod";
import bcrypt from "bcryptjs";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROLE_VALUES = ["owner", "manager", "kitchen", "courier_dispatch", "cashier"] as const;

const CreateSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(160),
  password: z.string().min(8).max(120),
  role: z.enum(ROLE_VALUES),
  branch_id: z.string().uuid().nullable().optional(),
});

export const GET = handler(async () => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiJson({ users: [] });
  const users = await prisma.merchantUser.findMany({
    where: { tenantId: session.tenantId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      branchId: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });
  return apiJson({
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      branch_id: u.branchId,
      last_login_at: u.lastLoginAt?.toISOString() ?? null,
      created_at: u.createdAt.toISOString(),
      is_me: u.id === session.userId,
    })),
  });
});

export const POST = handler(async (req: Request) => {
  const session = await requireMerchant(["owner"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const body = CreateSchema.parse(await req.json());
  const email = body.email.toLowerCase();

  const exists = await prisma.merchantUser.findUnique({
    where: { email },
    select: { id: true },
  });
  if (exists) {
    return apiError("conflict", "כתובת אימייל כבר בשימוש", 409);
  }

  // Cashier users must be pinned to a branch so the POS knows where to
  // route their queue + shift. Other roles accept it as optional metadata.
  let branchId: string | null = body.branch_id ?? null;
  if (body.role === "cashier") {
    if (!branchId) {
      const primary = await prisma.branch.findFirst({
        where: { tenantId: session.tenantId, isPrimary: true },
        select: { id: true },
      });
      branchId = primary?.id ?? null;
    }
    if (!branchId) {
      return apiError("no_branch", "צריך להגדיר סניף לקופאי", 422, "branch_id");
    }
  }

  const passwordHash = await bcrypt.hash(body.password, 10);
  const created = await prisma.merchantUser.create({
    data: {
      tenantId: session.tenantId,
      email,
      passwordHash,
      name: body.name,
      role: body.role,
      branchId,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      branchId: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });

  return apiJson(
    {
      user: {
        id: created.id,
        name: created.name,
        email: created.email,
        role: created.role,
        branch_id: created.branchId,
        last_login_at: null,
        created_at: created.createdAt.toISOString(),
        is_me: false,
      },
    },
    201,
  );
});
