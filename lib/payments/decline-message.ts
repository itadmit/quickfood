const HYP_REASONS: Record<string, string> = {
  "3": "חברת האשראי ביקשה לאשר את העסקה טלפונית. נסו כרטיס אחר או שלמו במזומן.",
  "4": "חברת האשראי סירבה לעסקה.",
  "6": "תעודת הזהות או 3 הספרות בגב הכרטיס לא נכונים.",
  "33": "הכרטיס לא תקין.",
  "36": "תוקף הכרטיס פג.",
  "39": "מספר הכרטיס לא נכון.",
};

const GENERIC = "הכרטיס לא חויב.";

export function declineMessage(provider: string, providerResponse: unknown): string {
  if (provider !== "hyp" || !providerResponse || typeof providerResponse !== "object") {
    return GENERIC;
  }
  const code = String((providerResponse as Record<string, unknown>).CCode ?? "").replace(/^0+/, "");
  return HYP_REASONS[code] ?? GENERIC;
}
