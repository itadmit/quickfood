import { z } from "zod";
import { handler, apiJson } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { uniqueProposalToken } from "@/lib/proposals/token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Create = z.object({
  clientName: z.string().trim().min(1).max(200),
  monthlyPrice: z.number().int().min(0).max(1_000_000),
  commissionStruck: z.string().trim().max(40).nullable().optional(),
  commissionActual: z.string().trim().max(40).nullable().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
});

export const GET = handler(async () => {
  await requireAdmin();
  const proposals = await prisma.proposal.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true, token: true, clientName: true, monthlyPrice: true,
      commissionStruck: true, commissionActual: true, notes: true,
      status: true, signerName: true, signedAt: true, createdAt: true,
    },
  });
  return apiJson({ proposals });
});

export const POST = handler(async (req: Request) => {
  await requireAdmin();
  const body = Create.parse(await req.json());
  const token = await uniqueProposalToken();
  const proposal = await prisma.proposal.create({
    data: {
      token,
      clientName: body.clientName,
      monthlyPrice: body.monthlyPrice,
      commissionStruck: body.commissionStruck || null,
      commissionActual: body.commissionActual || null,
      notes: body.notes || null,
    },
  });
  return apiJson({ proposal }, 201);
});
