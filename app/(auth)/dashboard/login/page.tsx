import LoginForm from "./LoginForm";
import { AuthShell } from "@/components/shared/AuthShell";

export const metadata = {
  title: "התחברות - QuickFood",
};

export default function LoginPage() {
  return (
    <AuthShell
      variant="login"
      title="ברוך השב."
      subtitle="התחבר לחשבון שלך והמשך לעבוד."
      illustration="kanban"
    >
      <LoginForm />
    </AuthShell>
  );
}
