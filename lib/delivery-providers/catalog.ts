export type DeliveryProviderId = "bali" | "sendi";

export interface DeliveryProviderField {
  key: string;
  label: string;
  secret?: boolean;
  optional?: boolean;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
}

export interface DeliveryProviderMeta {
  id: DeliveryProviderId;
  label: string;
  description: string;
  fields: DeliveryProviderField[];
}

export const DELIVERY_PROVIDERS: DeliveryProviderMeta[] = [
  {
    id: "bali",
    label: "בא לי",
    description: "חברת שליחויות. ההזמנה נשלחת אליהם והם שולחים שליח לאסוף אותה.",
    fields: [
      { key: "shopId", label: "מזהה המסעדה אצל בא לי", placeholder: "לדוגמה test1" },
      { key: "apiKey", label: "מפתח API (x-api-key)", secret: true },
    ],
  },
  {
    id: "sendi",
    label: "Sendi",
    description: "חברת שליחויות. ההזמנה נשלחת אליהם, וביטול או סימון \"מוכן\" מתעדכנים אצלם אוטומטית.",
    fields: [
      { key: "restUsername", label: "מזהה המסעדה אצל Sendi (rest_username)" },
      { key: "apiUsername", label: "שם משתמש API" },
      { key: "apiPassword", label: "סיסמת API", secret: true },
      {
        key: "environment",
        label: "סביבה",
        optional: true,
        options: [
          { value: "production", label: "ייצור" },
          { value: "staging", label: "בדיקות (staging)" },
        ],
      },
    ],
  },
];

export function providerMeta(id: string): DeliveryProviderMeta | undefined {
  return DELIVERY_PROVIDERS.find((p) => p.id === id);
}

export function providerLabel(id: string | null | undefined): string | null {
  if (!id) return null;
  return providerMeta(id)?.label ?? id;
}
