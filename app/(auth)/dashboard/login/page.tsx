import LoginForm from "./LoginForm";
import { QuickFoodLogo } from "@/components/shared/QuickFoodLogo";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-qf-bg-dash p-6">
      <div className="w-full max-w-md bg-white rounded-2xl border border-qf-line-dash shadow-sm p-8 space-y-6">
        <div className="space-y-3">
          <QuickFoodLogo
            href={null}
            size={44}
            wordmarkClassName="text-2xl"
            className="justify-center"
          />
          <p className="text-sm text-qf-mute text-center">
            ניהול מסעדה — התחברות
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
