import { redirect } from "next/navigation";

// WhatsApp connection + balance + packages moved into the unified "דיוור
// והתראות" hub (the connection now lives next to its credits and channel).
export default function WhatsappSettingsRedirect() {
  redirect("/dashboard/messaging");
}
