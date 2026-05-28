import type { AIMenuSnapshot, ShortIdMap } from "./menu-snapshot";

export type AIProviderKind = "gemini" | "claude";

export interface AIRecentOrder {
  orderNumber?: string | number;
  createdAt: string;
  items: Array<{ name: string; quantity: number }>;
}

export interface AICartLine {
  name: string;
  quantity: number;
  sizeName?: string | null;
  options?: string[];
}

export interface BuildPromptInput {
  menu: AIMenuSnapshot;
  recentOrders: AIRecentOrder[];
  currentCart: AICartLine[];
  customerName?: string | null;
  /** Branch minimum-order amount in shekels. 0 means no minimum. */
  minOrder?: number;
  /** Current cart subtotal in shekels. Used to know whether the cart
   *  already meets the minimum, and by how much it's short. */
  cartSubtotal?: number;
}

export interface BuiltPrompt {
  systemInstruction: string;
  idMap: ShortIdMap;
}

export interface ChatMessage {
  role: "user" | "model";
  text: string;
}

export interface StreamEvent {
  kind: "text" | "tool" | "done" | "error";
  text?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  error?: string;
}

export interface ToolSpec {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, ToolProperty>;
    required: string[];
  };
}

export interface ToolProperty {
  type: "string" | "integer" | "number" | "boolean" | "array";
  description?: string;
  items?: { type: "string" | "integer" | "number" | "boolean" };
}
