export interface AIToolCall {
  id: string;
  name: "recommend_items" | "propose_add_to_cart" | string;
  args: Record<string, unknown>;
  resolved?: boolean;
}

export interface AIChatMessage {
  id: string;
  role: "user" | "model";
  text: string;
  toolCalls?: AIToolCall[];
  pending?: boolean;
}

export interface AIRecommendItem {
  id: string;
  name: string;
  basePrice: number;
  description: string | null;
  imageUrl: string | null;
  href: string;
}

export interface AIProposal {
  itemId: string;
  itemName: string;
  basePrice: number;
  quantity: number;
  sizeId: string | null;
  sizeName: string | null;
  sizeDelta: number;
  options: Array<{ groupId: string; optionId: string; name: string; priceDelta: number }>;
  notes: string | null;
  imageUrl: string | null;
  unitPrice: number;
}
