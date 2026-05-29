import { redirect } from "next/navigation";
import { getCourierSession } from "@/lib/auth/courier-session";
import { CourierLoginForm } from "./CourierLoginForm";

export const dynamic = "force-dynamic";

export default async function CourierLoginPage() {
  const session = await getCourierSession();
  if (session) redirect("/courier/home");
  return (
    <main className="min-h-[100dvh] grid place-items-center px-5 py-10">
      <div className="w-full max-w-sm space-y-6">
        <header className="text-center space-y-1">
          <div className="inline-block px-3 py-1 rounded-full text-xs bg-white/10 text-white/70">
            QuickFood · אזור שליחים
          </div>
          <h1 className="text-2xl font-bold">התחברות שליח</h1>
          <p className="text-sm text-white/60">
            הכנס/י עם הטלפון או המייל שהמסעדה רשמה
          </p>
        </header>
        <CourierLoginForm />
      </div>
    </main>
  );
}
