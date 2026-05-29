import { redirect } from "next/navigation";
import { VerifyMagicClient } from "./VerifyMagicClient";

export const dynamic = "force-dynamic";

export default async function VerifyMagicPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const sp = await searchParams;
  const token = sp.token;
  if (!token) redirect("/courier/login");
  return (
    <main className="min-h-[100dvh] grid place-items-center px-5">
      <VerifyMagicClient token={token} />
    </main>
  );
}
