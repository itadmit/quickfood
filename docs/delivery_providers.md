# חברות משלוחים חיצוניות (Delivery Providers)

תשתית לחיבור חברות שליחויות חיצוניות לקוויק פוד. החברה הראשונה שחוברה היא **בא לי** (Bali), בנובמבר 2026.

## איך זה עובד אצל המסעדה

1. **הפעלה:** במסך השליחים (`/dashboard/couriers`) יש קטע "חברות משלוחים". כל חברה כבויה כברירת מחדל. המסעדה מדליקה אותה, ממלאת את פרטי החיבור (לבא לי: מזהה מסעדה ומפתח API), ושומרת. אי אפשר להדליק חברה בלי כל השדות.
2. **שליחה ידנית (ברירת המחדל):** כשמעבירים הזמנת משלוח ל"בדרך ללקוח", נפתח חלון מסירת ההזמנה לשליח. כל חברה פעילה מופיעה בו מעל השליחים הפנימיים. לחיצה על "שלח" שולחת את ההזמנה לחברה, מסמנת אותה בהזמנה ומעבירה אותה ל"בדרך ללקוח".
3. **שליחה אוטומטית (אופציונלי):** אם המסעדה הדליקה "שליחה אוטומטית כשמאשרים הזמנה", כל הזמנת משלוח נשלחת לחברה כשהמסעדה מאשרת אותה, כלומר כשההזמנה עוברת מ-pending ל-confirmed או ל-preparing.
4. **סימון:** על כרטיס ההזמנה בלוח מופיע תג עם שם החברה.

הזמנות איסוף עצמי לא נשלחות אף פעם. הזמנה שכבר נשלחה לחברה לא תישלח שוב: לחיצה חוזרת רק מקדמת סטטוס, ושליחה לחברה אחרת נחסמת.

## מבנה הקוד

| קובץ | תפקיד |
|---|---|
| `lib/delivery-providers/catalog.ts` | רשימת החברות: מזהה, שם בעברית, תיאור ושדות ההגדרה. בטוח לייבוא גם בצד הלקוח, כי אין בו סודות. |
| `lib/delivery-providers/config.ts` | קריאת ההגדרות של מסעדה (`readProviderSettings`), בדיקה שחברה מוכנה (`isProviderReady`), ורשימת החברות הפעילות לחלון (`activeDeliveryProviders`). |
| `lib/delivery-providers/types.ts` | `ProviderOrder`, ההזמנה בצורה אחידה לכל החברות, ו-`ProviderSendResult`. |
| `lib/delivery-providers/bali.ts` | השולח של בא לי, שממיר `ProviderOrder` לפורמט שלהם. |
| `lib/delivery-providers/dispatch.ts` | `dispatchOrderToProvider` (בדיקות, שליחה, רישום אירוע, סימון ההזמנה) ו-`autoDispatchOnAccept`. כאן נמצאת טבלת `SENDERS`. |
| `lib/delivery-providers/client.ts` | קריאה מהדפדפן ל-API השליחה. |
| `app/api/v1/merchant/delivery-providers/route.ts` | GET / PUT להגדרות המסעדה. מפתחות סודיים לא חוזרים ב-GET, ושדה סודי ריק ב-PUT משאיר את הערך הקיים. |
| `app/api/v1/merchant/orders/[id]/delivery-provider/route.ts` | POST `{ provider }` ששולח הזמנה לחברה. |
| `components/merchant/DeliveryProvidersPanel.tsx` | קטע ההגדרות במסך השליחים. נבנה אוטומטית מהקטלוג. |
| `components/merchant/AssignCourierModal.tsx` | החלון. מקבל `providers`, `onProvider` ו-`sentToProvider`. |
| `lib/orders.ts` | קורא ל-`autoDispatchOnAccept` במעבר לאישור. |

## נתונים

- `Tenant.deliveryProviders` (`tenants.delivery_providers`, JSONB, ברירת מחדל `{}`). מפתח לכל חברה:
  `{ "bali": { "enabled": false, "autoDispatch": false, "prepMinutes": 15, "shopId": "...", "apiKey": "..." } }`.
  השדות הייעודיים של כל חברה (כאן `shopId` ו-`apiKey`) יושבים לצד השדות הכלליים. אלה סודות: אסור לרשום אותם בלוג או לחשוף אותם בחנות.
- `Order.deliveryProvider` (`orders.delivery_provider`): מזהה החברה שאליה נשלחה ההזמנה.
- `Order.deliveryProviderDispatchedAt` (`orders.delivery_provider_dispatched_at`): מתי נשלחה.
- כל ניסיון שליחה, מוצלח או כושל, נרשם ב-`OrderEvent` מסוג `delivery_provider_dispatched` או `delivery_provider_failed`, עם שם החברה, המקור (manual/auto), קוד HTTP והתשובה.
- מיגרציה: `prisma/migrations/20261109120000_delivery_providers`. כבר הוחלה על Neon.

## הוספת חברה חדשה

1. **קטלוג:** ב-`catalog.ts` מוסיפים את המזהה ל-`DeliveryProviderId` ורשומה ל-`DELIVERY_PROVIDERS`, עם `label`, `description` ו-`fields`. שדה סודי מסמנים `secret: true`.
2. **שולח:** יוצרים `lib/delivery-providers/<id>.ts` עם פונקציה `(order: ProviderOrder, settings) => Promise<ProviderSendResult>`. את ערכי השדות קוראים מ-`settings.values.<key>` ואת זמן ההכנה מ-`settings.prepMinutes`. כדאי timeout של כ-8 שניות. מחזירים `ok: false` במקום לזרוק שגיאה.
3. **רישום:** מוסיפים את השולח לטבלת `SENDERS` ב-`dispatch.ts`. TypeScript יכשיל את הבנייה אם שכחו.
4. **חוץ מזה לא צריך לשנות כלום:** מסך ההגדרות, החלון, ה-API והתג נבנים מהקטלוג.
5. **בדיקה:** שולחים הזמנת בדיקה אחת לסביבת הבדיקה של החברה, מתעדים את התשובה, ומשאירים את החברה כבויה עד שהמסעדה מדליקה.
6. אם נדרש `ProviderOrder` עשיר יותר (פריטים, סכום לגבייה במזומן), מרחיבים את `types.ts` ואת הבנייה ב-`dispatchOrderToProvider`. השולחים הקיימים פשוט יתעלמו מהשדות החדשים.

## בא לי (Bali)

- איש קשר: שוקי אמין.
- כתובת: `POST https://6sald4neod.execute-api.eu-central-1.amazonaws.com/default/bali-create-new-order`. אפשר לעקוף אותה במשתנה הסביבה `BALI_CREATE_ORDER_URL`.
- אימות: הכותרת `x-api-key`. המפתח נשמר אצל המסעדה, לא במשתני סביבה.
- גוף הבקשה: `shopID, orderID, name, phone, address, latitude, longitude, entrance, flatNumber, floor, remarks, prepTime`.
- תשובה: בהצלחה מגיע HTTP 200 עם הטקסט `status code: 200`, בלי מזהה הזמנה. קלט לא תקין מחזיר HTTP 500 בלי פירוט.
- **אין** ממשק לביטול הזמנה ואין webhook לסטטוס השליח, ולכן ביטול נעשה מולם ידנית.
- מסעדה ראשונה: נונה (`nuna`), מזהה אצלם `test1`. ההגדרה שמורה אבל כבויה עד שהמסעדה מדליקה. הזמנת בדיקה `QF-TEST-1` נשלחה ב-9.11.2026.

## ההבדל מ-DelivApp

DelivApp (`lib/delivapp`) הוא חיבור ישן ונפרד: עמוד הגדרות משלו, עמודות ייעודיות ב-Order, webhook נכנס, ביטול וסימון "מוכן". הוא נשאר כמו שהוא. חברות חדשות מתחברות דרך התשתית הזאת. אם בעתיד נעביר את DelivApp אליה, צריך להוסיף לשולחים פעולות `cancel` ו-`ready` ונקודת webhook כללית.
