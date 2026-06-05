import { buildShortIdMap, serializeMenuForPrompt } from "./menu-snapshot";
import type { BuildPromptInput, BuiltPrompt, ToolSpec } from "./types";

export function buildSystemPrompt(input: BuildPromptInput): BuiltPrompt {
  const { menu, recentOrders, currentCart, customerName, minOrder, cartSubtotal } = input;
  const idMap = buildShortIdMap(menu);
  const parts: string[] = [];

  parts.push(
    `יועץ-הזמנות של ${menu.tenantName}. עזור ללקוח לבחור מנות לפי התפריט בלבד.`,
  );
  parts.push(``);
  parts.push(`### חוק הברזל - שפה ###`);
  parts.push(`כתוב אך ורק עברית. לעולם לעולם לעולם אל תייצר אות אחת מהאלפבית הערבי (ا ب ت ث ج ح خ ד ذ ر ز س ش ص ض ط ظ ع غ ف ق ك ل م ن ه و ي), גם לא כדוגמה, גם לא כתרגום, גם לא במילה בודדת. אם הלקוח כותב בערבית - ענה בעברית.`);
  parts.push(`אם נראה לך להוסיף ברכה מהשפה הערבית או מילה כמו "סבאח" / "אהלן" וכו׳ - תכתוב אותה רק באותיות עבריות (transliteration), אף פעם לא באותיות ערביות.`);
  parts.push(``);
  parts.push(`כללים:`);
  parts.push(`1. עברית בלבד - לעולם לא ערבית. ראה את חוק הברזל לעיל. שמות פריטים/תוספות תמיד בעברית בדיוק כפי שמופיעים בתפריט. אנגלית מותרת רק אם מותג נכתב במקור באנגלית (Coca-Cola, Pepsi וכו').`);
  parts.push(`2. קצר ועברי-טבעי (משפט-שניים בכל תור).`);
  parts.push(`3. כשממליץ על 2+ פריטים - חובה לקרוא ל-recommend_items עם ה-IDs מהתפריט. אל תרשום אותם בטקסט.`);
  parts.push(`4. פריט מוגדר → propose_add_to_cart. מילוי options חובה (סימן !) לפי minSelect, לא לעבור maxSelect.`);
  parts.push(`5. אחרי שהלקוח אישר פריט, שאל פעם אחת אם יש הערה (אלרגיה, בלי משהו, מתובל, וכו'). אם כן - קרא שוב ל-propose_add_to_cart עם אותם פרמטרים + שדה notes.`);
  parts.push(`6. אל תמציא - רק IDs מהתפריט. הסבר אם משהו לא קיים.`);
  parts.push(`7. בלי markdown (אין * או **).`);
  parts.push(`8. ה-IDs (x1, x2c, x24 וכו') הם פנימיים בלבד. לעולם אל תזכיר אותם בטקסט שהלקוח רואה.`);
  if (minOrder && minOrder > 0) {
    parts.push(`9. החנות דורשת מינימום הזמנה של ${minOrder}₪. תמיד תהיה מודע אליו: אם הסכום בעגלה עוד לא מגיע למינימום, אחרי כל הוספה זכור להזכיר ללקוח כמה חסר ולהציע פריט נוסף קטן מהתפריט כדי להגיע למינימום. אם הסכום כבר מעל המינימום - אין צורך להזכיר.`);
    parts.push(`10. אחרי שהלקוח הוסיף פריט/ים, אם הוא מסיים - תמיד תיידע אותו שהוא יכול לעבור לעגלה. אל תפעיל כלי לפעולה הזו, רק תאמר את זה במשפט קצר.`);
  } else {
    parts.push(`9. אחרי שהלקוח הוסיף פריט/ים, אם הוא מסיים - תמיד תיידע אותו שהוא יכול לעבור לעגלה. אל תפעיל כלי לפעולה הזו, רק תאמר את זה במשפט קצר.`);
  }
  parts.push(``);
  parts.push(`פורמט תפריט: x#=שם|מחיר. ! = חובה. * = ברירת מחדל. ½ = חצי-חצי. (מספר חינם) = הראשונים חינם.`);
  parts.push(``);

  if (customerName) {
    parts.push(`לקוח: ${customerName}`);
  }

  if (recentOrders.length > 0) {
    parts.push(`הזמנות קודמות:`);
    for (const o of recentOrders.slice(0, 3)) {
      parts.push(`${o.createdAt}: ${o.items.map((i) => `${i.quantity}×${i.name}`).join(",")}`);
    }
  }

  if (minOrder && minOrder > 0) {
    parts.push(`מינימום הזמנה: ${minOrder}₪`);
    if (typeof cartSubtotal === "number") {
      const remaining = minOrder - cartSubtotal;
      if (remaining > 0) {
        parts.push(`סכום בעגלה כרגע: ${cartSubtotal}₪ · חסר ${remaining}₪ למינימום.`);
      } else {
        parts.push(`סכום בעגלה כרגע: ${cartSubtotal}₪ · מעל המינימום.`);
      }
    }
  }

  if (currentCart.length > 0) {
    parts.push(`בעגלה:`);
    for (const l of currentCart) {
      const opts = l.options?.length ? `(${l.options.join(",")})` : "";
      parts.push(`${l.quantity}×${l.name}${l.sizeName ? ` ${l.sizeName}` : ""}${opts}`);
    }
  }

  parts.push(``);
  parts.push(serializeMenuForPrompt(menu, idMap));
  return { systemInstruction: parts.join("\n"), idMap };
}

export const ADVISOR_TOOLS: ToolSpec[] = [
  {
    name: "recommend_items",
    description:
      "הצג ללקוח כרטיסי-פריט להמלצה (עד 4). השתמש בזה כשאתה ממליץ על אופציות אבל הלקוח עדיין לא בחר.",
    parameters: {
      type: "object",
      properties: {
        item_ids: {
          type: "array",
          description: "מזהי פריטים בתפריט",
          items: { type: "string" },
        },
        reason: {
          type: "string",
          description: "משפט קצר שמסביר ללקוח למה אלו ההמלצות.",
        },
      },
      required: ["item_ids"],
    },
  },
  {
    name: "propose_add_to_cart",
    description:
      "הצע ללקוח להוסיף פריט מוגדר לעגלה (עם מידה ותוספות). הלקוח יאשר בלחיצה לפני שזה נכנס לעגלה.",
    parameters: {
      type: "object",
      properties: {
        item_id: { type: "string", description: "id של הפריט מהתפריט" },
        quantity: { type: "integer", description: "כמות (ברירת מחדל 1)" },
        size_id: { type: "string", description: "id של המידה אם יש מידות" },
        option_ids: {
          type: "array",
          description: "id-ים של תוספות נבחרות",
          items: { type: "string" },
        },
        notes: { type: "string", description: "הערה (למשל 'בלי בצל')" },
      },
      required: ["item_id"],
    },
  },
];
