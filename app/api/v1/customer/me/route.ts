import { handler, apiJson } from "@/lib/api-response";
import { requireCustomer } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { CustomerUpdateSchema } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const session = await requireCustomer();
  const customer = await prisma.customer.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      phone: true,
      email: true,
      firstName: true,
      lastName: true,
      createdAt: true,
    },
  });
  if (!customer) return apiJson({ customer: null });
  return apiJson({
    customer: {
      id: customer.id,
      phone: customer.phone,
      email: customer.email,
      first_name: customer.firstName,
      last_name: customer.lastName,
      createdAt: customer.createdAt,
    },
  });
});

export const PATCH = handler(async (req: Request) => {
  const session = await requireCustomer();
  const body = CustomerUpdateSchema.parse(await req.json());
  const customer = await prisma.customer.update({
    where: { id: session.userId },
    data: {
      ...(body.first_name !== undefined && { firstName: body.first_name }),
      ...(body.last_name !== undefined && { lastName: body.last_name }),
      ...(body.email !== undefined && { email: body.email }),
    },
    select: {
      id: true,
      phone: true,
      email: true,
      firstName: true,
      lastName: true,
    },
  });
  return apiJson({
    customer: {
      id: customer.id,
      phone: customer.phone,
      email: customer.email,
      first_name: customer.firstName,
      last_name: customer.lastName,
    },
  });
});

export const DELETE = handler(async () => {
  const session = await requireCustomer();
  // GDPR - anonymize, do not delete (retain historical orders for accounting).
  await prisma.customer.update({
    where: { id: session.userId },
    data: {
      anonymized: true,
      firstName: "anonymized",
      lastName: "",
      email: null,
      phone: `deleted:${session.userId}`,
    },
  });
  return apiJson({ ok: true });
});
