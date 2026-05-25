import { redirect } from "next/navigation";

export default async function ItemPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; itemId: string }>;
}) {
  const { tenantSlug, itemId } = await params;
  redirect(`/s/${tenantSlug}?item=${itemId}`);
}
