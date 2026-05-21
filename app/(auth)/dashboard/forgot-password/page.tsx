import { AuthShell } from "@/components/shared/AuthShell";
import ForgotPasswordForm from "./ForgotPasswordForm";

export const metadata = {
  title: "שכחת סיסמה — QuickFood",
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      variant="login"
      title="שכחת סיסמה?"
      subtitle="נשלח קישור איפוס למייל שלך."
      illustration="kanban"
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
