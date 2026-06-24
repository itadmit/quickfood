import { redirect } from "next/navigation";

// Customer notification settings moved into the unified "דיוור" hub.
export default function NotificationsSettingsRedirect() {
  redirect("/dashboard/messaging");
}
