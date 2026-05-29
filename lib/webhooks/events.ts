export type WebhookEventType =
  | "order.created"
  | "order.status_changed"
  | "order.cancelled"
  | "order.refunded"
  | "order.items_edited"
  | "order.details_edited"
  | "order.ready_for_print";

export const ALL_WEBHOOK_EVENTS: WebhookEventType[] = [
  "order.created",
  "order.status_changed",
  "order.cancelled",
  "order.refunded",
  "order.items_edited",
  "order.details_edited",
  "order.ready_for_print",
];

export interface WebhookEnvelope<T = unknown> {
  id: string;            // delivery id
  event: WebhookEventType;
  created_at: string;    // ISO
  tenant_id: string;
  data: T;
}
