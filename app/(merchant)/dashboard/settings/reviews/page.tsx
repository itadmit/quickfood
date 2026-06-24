import { redirect } from "next/navigation";

// Review reminder + sender settings moved into the unified "דיוור" hub.
export default function ReviewsSettingsRedirect() {
  redirect("/dashboard/messaging");
}
