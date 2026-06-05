import { redirect } from "next/navigation";

// The standalone "פרטי עסק" page was merged into /settings/branding so
// every fact about the store (branch details + branding + share) lives
// in one place. Keep this route alive as a permanent redirect for any
// old bookmark / external link.
export default function BusinessSettingsPage() {
  redirect("/dashboard/settings/branding");
}
