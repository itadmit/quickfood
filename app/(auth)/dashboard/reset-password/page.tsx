import { AuthShell } from "@/components/shared/AuthShell";
import ResetPasswordForm from "./ResetPasswordForm";

export const metadata = {
  title: "סיסמה חדשה — QuickFood",
};

interface SearchParams {
  searchParams: Promise<{ token?: string }>;
}

export default async function ResetPasswordPage({ searchParams }: SearchParams) {
  const { token } = await searchParams;
  return (
    <AuthShell
      variant="login"
      title="סיסמה חדשה"
      subtitle="בחר סיסמה חדשה לחשבון שלך."
      illustration="kanban"
    >
      <ResetPasswordForm token={token ?? ""} />
    </AuthShell>
  );
}
