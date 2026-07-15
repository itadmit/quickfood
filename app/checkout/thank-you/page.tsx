import { redirect } from "next/navigation";
import { IcoCheck } from "@/components/shared/Icons";
import { resolveCheckoutRedirect } from "../resolve";

export const dynamic = "force-dynamic";

export default async function CheckoutThankYouPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const target = await resolveCheckoutRedirect(await searchParams, "success");
  if (target.path) redirect(target.path);

  return (
    <main dir="rtl" className="min-h-screen bg-[#FFFBEC] grid place-items-center p-6">
      <div className="max-w-sm w-full bg-white rounded-3xl border-2 border-black shadow-[0_4px_0_#000] p-8 text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-[#F8CB1E] border-2 border-black grid place-items-center mb-4">
          <IcoCheck c="#000" s={26} />
        </div>
        <h1 className="text-xl font-black mb-2">התשלום התקבל!</h1>
        <p className="text-sm text-black/70 leading-relaxed">
          ההזמנה שלך נקלטה והמסעדה קיבלה אותה. אפשר לסגור את החלון הזה.
        </p>
      </div>
    </main>
  );
}
