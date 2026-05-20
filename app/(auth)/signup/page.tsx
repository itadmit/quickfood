import { SignupForm } from "./SignupForm";

export const metadata = {
  title: "הרשמה — QuickFood",
  description: "פתח את המסעדה שלך אונליין בפחות מ-10 דקות. בלי אגרגטור, בלי עמלות פר הזמנה.",
};

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-qf-bg-dash p-6 flex items-center justify-center">
      <SignupForm />
    </div>
  );
}
