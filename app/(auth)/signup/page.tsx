import { SignupForm } from "./SignupForm";
import { AuthShell } from "@/components/shared/AuthShell";

export const metadata = {
  title: "הרשמה — QuickFood",
  description:
    "פתח את המסעדה שלך אונליין בפחות מ-10 דקות. בלי אגרגטור, בלי עמלות פר הזמנה.",
};

export default function SignupPage() {
  return (
    <AuthShell
      variant="signup"
      title="בוא נפתח חנות."
      subtitle="11 דקות מהרגע הזה ועד שיש לך הזמנות אמיתיות. בלי כרטיס אשראי."
      illustration="menu"
    >
      <SignupForm />
    </AuthShell>
  );
}
