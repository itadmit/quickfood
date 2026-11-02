import { handler, apiError } from "@/lib/api-response";
const disabled = handler(async () => apiError("channel_disabled", "ערוץ וואטסאפ אינו זמין כרגע. ניתן להשתמש ב-SMS.", 410));
export const POST = disabled;
