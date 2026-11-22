export interface KioskCartLineInput {
  itemId: string;
  quantity: number;
  sizeId: string | null;
  options: Array<{ optionId: string }>;
  notes: string | null;
}

export function kioskOrderLines(lines: KioskCartLineInput[]) {
  return lines.map((l) => ({
    item_id: l.itemId,
    quantity: l.quantity,
    size_id: l.sizeId,
    option_ids: l.options.map((o) => o.optionId),
    notes: l.notes?.trim() || null,
  }));
}
