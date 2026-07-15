import { redirect } from "next/navigation";
import { resolveCheckoutRedirect } from "../resolve";

export const dynamic = "force-dynamic";

export default async function CheckoutFailedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const target = await resolveCheckoutRedirect(await searchParams, "failed");
  if (target.path) redirect(target.path);

  return (
    <main dir="rtl" className="min-h-screen bg-[#FFFBEC] grid place-items-center p-6">
      <div className="max-w-sm w-full bg-white rounded-3xl border-2 border-black shadow-[0_4px_0_#000] p-8 text-center">
        <h1 className="text-xl font-black mb-2">התשלום נכשל</h1>
        <p className="text-sm text-black/70 leading-relaxed">
          החיוב לא הושלם. אפשר לחזור לחנות ולנסות שוב, או לשלם במזומן.
        </p>
      </div>
    </main>
  );
}
