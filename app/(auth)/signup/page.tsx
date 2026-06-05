import { SignupForm } from "./SignupForm";
import { AuthShell } from "@/components/shared/AuthShell";

export const metadata = {
  title: "הרשמה - QuickFood",
  description:
    "פתח את האתר של המסעדה שלך בפחות מ-5 דקות. לצד וולט - הלקוחות הקבועים שלך מזמינים ישירות אצלך, בלי 30% עמלה על כל הזמנה חוזרת.",
};

export default function SignupPage() {
  return (
    <AuthShell
      variant="signup"
      title="בוא נפתח חנות."
      subtitle="5 דקות מהרגע הזה ועד שיש לך הזמנות אמיתיות. בלי כרטיס אשראי."
      illustration="menu"
    >
      <SignupForm />
    </AuthShell>
  );
}
