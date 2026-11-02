/** All WhatsApp transports are disabled, including the official channel. */
export interface QuickChatResult {
  ok: boolean;
  detail: string;
  /** Which route Quick Chat actually used - "text" is the free one. */
  mode?: "text" | "template";
  /** True when Meta billed for this send. */
  billable?: boolean;
  /** True when an idempotencyKey caught a repeat - nothing was sent. */
  duplicate?: boolean;
}

export function isQuickChatConfigured(): boolean { return false; }
export async function sendViaQuickChat(_input: {
  phone: string; text: string; contactName?: string;
  template: { name: string; language?: string; variables: string[] };
  idempotencyKey: string;
}): Promise<QuickChatResult> {
  void _input;
  return { ok: false, detail: "whatsapp_disabled" };
}
