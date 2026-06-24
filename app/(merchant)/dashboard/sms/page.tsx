import { redirect } from "next/navigation";

// SMS / messaging credits were consolidated into the unified "דיוור" hub.
export default function SmsRedirect() {
  redirect("/dashboard/messaging");
}
