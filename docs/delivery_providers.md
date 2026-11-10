# חברות משלוחים חיצוניות (Delivery Providers)

תשתית לחיבור חברות שליחויות חיצוניות לקוויק פוד. מחוברות כרגע: **בא לי** (Bali) ו-**Sendi**, שתיהן מנובמבר 2026.

## איך זה עובד אצל המסעדה

1. **הפעלה:** במסך השליחים (`/dashboard/couriers`) יש קטע "חברות משלוחים". כל חברה כבויה כברירת מחדל. המסעדה מדליקה אותה, ממלאת את פרטי החיבור (לבא לי: מזהה מסעדה ומפתח API), ושומרת. אי אפשר להדליק חברה בלי כל השדות.
2. **שליחה ידנית (ברירת המחדל):** כשמעבירים הזמנת משלוח ל"בדרך ללקוח", נפתח חלון מסירת ההזמנה לשליח. כל חברה פעילה מופיעה בו מעל השליחים הפנימיים. לחיצה על "שלח" שולחת את ההזמנה לחברה, מסמנת אותה בהזמנה ומעבירה אותה ל"בדרך ללקוח".
3. **שליחה אוטומטית (אופציונלי):** אם המסעדה הדליקה "שליחה אוטומטית כשמאשרים הזמנה", כל הזמנת משלוח נשלחת לחברה כשהמסעדה מאשרת אותה, כלומר כשההזמנה עוברת מ-pending ל-confirmed או ל-preparing.
4. **סימון:** על כרטיס ההזמנה בלוח מופיע תג עם שם החברה.
5. **ביטול ו"מוכן":** אם לחברה יש ממשק מתאים, ביטול או החזר של הזמנה שנשלחה מבטל אותה גם אצל החברה, וסימון ההזמנה כ"מוכנה" מעדכן אותם. לבא לי אין ממשק כזה, ול-Sendi יש.

הזמנות איסוף עצמי לא נשלחות אף פעם. הזמנה שכבר נשלחה לחברה לא תישלח שוב: לחיצה חוזרת רק מקדמת סטטוס, ושליחה לחברה אחרת נחסמת.

## מבנה הקוד

| קובץ | תפקיד |
|---|---|
| `lib/delivery-providers/catalog.ts` | רשימת החברות: מזהה, שם בעברית, תיאור ושדות ההגדרה. בטוח לייבוא גם בצד הלקוח, כי אין בו סודות. |
| `lib/delivery-providers/config.ts` | קריאת ההגדרות של מסעדה (`readProviderSettings`), בדיקה שחברה מוכנה (`isProviderReady`), ורשימת החברות הפעילות לחלון (`activeDeliveryProviders`). |
| `lib/delivery-providers/types.ts` | `ProviderOrder`, ההזמנה בצורה אחידה לכל החברות, `ProviderSendResult`, ו-`DeliveryProviderAdapter`: `send` חובה, `cancel` ו-`ready` אופציונליים. |
| `lib/delivery-providers/http.ts` | `providerPost`: בקשת JSON עם timeout של 8 שניות. מחזיר את הטקסט ואת ה-JSON ולא זורק שגיאה. |
| `lib/delivery-providers/bali.ts` | המתאם של בא לי (`send` בלבד). |
| `lib/delivery-providers/sendi.ts` | המתאם של Sendi (`send`, `cancel`, `ready`). |
| `lib/delivery-providers/dispatch.ts` | `dispatchOrderToProvider` (בדיקות, שליחה, רישום אירוע, סימון ההזמנה), `autoDispatchOnAccept`, `cancelProviderDelivery` ו-`markProviderReady`. כאן נמצאת טבלת `ADAPTERS`. |
| `lib/delivery-providers/client.ts` | קריאה מהדפדפן ל-API השליחה. |
| `app/api/v1/merchant/delivery-providers/route.ts` | GET / PUT להגדרות המסעדה. מפתחות סודיים לא חוזרים ב-GET, ושדה סודי ריק ב-PUT משאיר את הערך הקיים. |
| `app/api/v1/merchant/orders/[id]/delivery-provider/route.ts` | POST `{ provider }` ששולח הזמנה לחברה. |
| `components/merchant/DeliveryProvidersPanel.tsx` | קטע ההגדרות במסך השליחים. נבנה אוטומטית מהקטלוג. |
| `components/merchant/AssignCourierModal.tsx` | החלון. מקבל `providers`, `onProvider` ו-`sentToProvider`. |
| `lib/orders.ts` | קורא ל-`autoDispatchOnAccept` באישור, ל-`markProviderReady` במעבר ל-ready, ול-`cancelProviderDelivery` בביטול. |
| `app/api/v1/merchant/orders/[id]/refund/route.ts` | קורא ל-`cancelProviderDelivery` בהחזר. |

## נתונים

- `Tenant.deliveryProviders` (`tenants.delivery_providers`, JSONB, ברירת מחדל `{}`). מפתח לכל חברה:
  `{ "bali": { "enabled": false, "autoDispatch": false, "prepMinutes": 15, "shopId": "...", "apiKey": "..." } }`.
  השדות הייעודיים של כל חברה (כאן `shopId` ו-`apiKey`) יושבים לצד השדות הכלליים. אלה סודות: אסור לרשום אותם בלוג או לחשוף אותם בחנות.
- `Order.deliveryProvider` (`orders.delivery_provider`): מזהה החברה שאליה נשלחה ההזמנה.
- `Order.deliveryProviderDispatchedAt` (`orders.delivery_provider_dispatched_at`): מתי נשלחה.
- כל פעולה מול חברה נרשמת ב-`OrderEvent`. סוגי האירועים הם `delivery_provider_dispatched`, `delivery_provider_cancelled`, `delivery_provider_ready` ו-`delivery_provider_failed`, וכל אירוע כולל את החברה, הפעולה, המקור (manual/auto), קוד HTTP והתשובה.
- **מזהה ההזמנה אצל החברה** (`ref`), אם החברה מחזירה כזה, נשמר ב-payload של אירוע `delivery_provider_dispatched`. משם הוא נשלף לביטול, כך שלא צריך עמודה נוספת. ב-Sendi זה `data.order_id`.
- מיגרציה: `prisma/migrations/20261109120000_delivery_providers`. כבר הוחלה על Neon.

## הוספת חברה חדשה

1. **קטלוג:** ב-`catalog.ts` מוסיפים את המזהה ל-`DeliveryProviderId` ורשומה ל-`DELIVERY_PROVIDERS`, עם `label`, `description` ו-`fields`. סוגי שדות:
   - `secret: true`: נשמר ולא מוחזר למסך. אם משאירים אותו ריק בשמירה, הערך הקיים נשמר.
   - `optional: true`: לא חובה כדי להדליק את החברה.
   - `options: [{value,label}]`: מוצג כרשימה נפתחת. ערך לא חוקי חוזר לאפשרות הראשונה, כמו בסביבת הייצור/בדיקות של Sendi.
2. **מתאם:** יוצרים `lib/delivery-providers/<id>.ts` שמייצא `DeliveryProviderAdapter`. `send` חובה. אם החברה מחזירה מזהה הזמנה, מחזירים אותו כ-`ref`. `cancel` ו-`ready` מוסיפים רק אם יש להם ממשק. משתמשים ב-`providerPost`, קוראים שדות מ-`settings.values.<key>` ואת זמן ההכנה מ-`settings.prepMinutes`. לא זורקים שגיאות. אם החברה מחזירה HTTP 200 עם שגיאה בגוף התשובה, צריך להחזיר `ok: false`.
3. **רישום:** מוסיפים את המתאם לטבלת `ADAPTERS` ב-`dispatch.ts`. TypeScript יכשיל את הבנייה אם שכחו.
4. **חוץ מזה לא צריך לשנות כלום:** מסך ההגדרות, החלון, ה-API והתג נבנים מהקטלוג.
5. **בדיקה:** שולחים הזמנת בדיקה אחת לסביבת הבדיקה של החברה, מתעדים את התשובה, ומשאירים את החברה כבויה עד שהמסעדה מדליקה.
6. `ProviderOrder` כבר כולל עיר ורחוב בנפרד, סכום לגבייה במזומן (`cashToCollect`, רק בהזמנת מזומן שלא שולמה) וטיפ. אם נדרש שדה נוסף, למשל פריטים, מרחיבים את `types.ts` ואת הבנייה ב-`dispatchOrderToProvider`.

## בא לי (Bali)

- איש קשר: שוקי אמין.
- כתובת: `POST https://6sald4neod.execute-api.eu-central-1.amazonaws.com/default/bali-create-new-order`. אפשר לעקוף אותה במשתנה הסביבה `BALI_CREATE_ORDER_URL`.
- אימות: הכותרת `x-api-key`. המפתח נשמר אצל המסעדה, לא במשתני סביבה.
- גוף הבקשה: `shopID, orderID, name, phone, address, latitude, longitude, entrance, flatNumber, floor, remarks, prepTime`.
- תשובה: בהצלחה מגיע HTTP 200 עם הטקסט `status code: 200`, בלי מזהה הזמנה. קלט לא תקין מחזיר HTTP 500 בלי פירוט.
- **אין** ממשק לביטול הזמנה ואין webhook לסטטוס השליח, ולכן ביטול נעשה מולם ידנית.
- סביבת בדיקות ואמת משתמשות באותה כתובת. ההבדל הוא רק במפתח וב-shopID.
- מסעדה ראשונה: נונה (`nuna`). בבדיקות: `test1`, הזמנת בדיקה `QF-TEST-1` ב-9.11.2026. בסביבת האמת: `nona-1` עם מפתח אמת, מ-10.11.2026, והזמנת בדיקה `QF-TEST-2` בשם "בדיקה" התקבלה (HTTP 200).

## Sendi

- תיעוד: https://admin.staging-sendimanapi.com/api-docs (OpenAPI ב-`/openapi.json`). אנחנו משתמשים במסלול הישן (legacy), שמתאים לחנות שכבר מוגדרת אצל Sendi.
- שרתים: ייצור `https://sendimanapi.com`, בדיקות `https://staging-sendimanapi.com`. המסעדה בוחרת בשדה "סביבה".
- אימות: Basic Auth עם שם משתמש וסיסמת API, שאת שניהם נותנת Sendi. בנוסף נשלח `rest_username`, מזהה המסעדה אצלם.
- יצירה: `POST /delivery/createDelivery` (JSON). שדות: `rest_username, order_id, client_phone, client_name, delivery_address, client_city, client_street, client_apartment, client_entry, client_floor, client_latitude, client_longitude, client_notes, order_delay`, ובנוסף `sum_cash` למזומן ו-`runner_tip` לטיפ. בהצלחה מוחזר `data.order_id`, מזהה Sendi שנשמר כ-`ref`. שגיאת תשלום מוחזרת כ-`{status:"error", data:{code:"payment_required"}}`.
- ביטול: `POST /delivery/cancelDelivery {order_id: <ref>}`. אפשרי רק לפני איסוף.
- מוכן: `POST /delivery/updateDeliveryPreparationTime {order_id: <מספר ההזמנה שלנו>, cook_time: 0, rest_username}`.
- **עוד לא נבנה:** webhook לסטטוס השליח, שאמור לשלוח `delivery_status` 1-7 ו-`tracker_link`. בשביל זה צריך נקודת קליטה עם טוקן לכל מסעדה, ו-Sendi צריכה להגדיר את הכתובת אצלה. גם `getDeliveryTracker` (קישור מעקב) ומסלול DaaS v1 (הרשמה, הצעת מחיר, תשלום) לא נבנו.
- נבדק: שרת הבדיקות עונה, ופרטי התחברות שגויים מחזירים 403 `wrong credentials`, שמוצג אצלנו ככישלון. עוד לא נשלחה הזמנה אמיתית, כי אין לנו פרטי התחברות מ-Sendi.

## DelivApp

DelivApp (`lib/delivapp`) הוא חיבור ותיק עם מנגנון נפרד: `Tenant.delivAppConfig`, עמודות `delivApp*` ב-Order, webhook נכנס (`/api/v1/integrations/delivapp/callback`), ביטול וסימון "מוכן". הוא שולח אוטומטית כשמאשרים הזמנה, ולא מופיע כאפשרות בחלון השליחים.

- **מסך:** מאז 9.11.2026 ההגדרות של DelivApp נמצאות בקטע "חברות משלוחים" במסך השליחים (`components/merchant/DelivAppProviderCard.tsx`), ליד שאר החברות. הלשונית הנפרדת בהגדרות הוסרה, והכתובת הישנה `/dashboard/settings/delivapp` מפנה למסך השליחים.
- **מה לא השתנה:** הלוגיקה, ה-API (`/api/v1/merchant/settings/delivapp`) והנתונים נשארו כמו שהיו. מסעדות שכבר עובדות עם DelivApp (haeglon) לא הושפעו.
- **שדות החיבור:** מוגדרים עם `autoComplete="off"`, ושדה המפתח עם `new-password`, כי הדפדפן מילא בהם בטעות מייל וסיסמה של משתמש.
- **אם נרצה לאחד לגמרי:** צריך להעביר את DelivApp למתאם עם `send`, `cancel` ו-`ready`, ולהעביר את הנתונים מ-`delivAppConfig` אל `deliveryProviders.delivapp`. העמודות ב-Order ו-ה-webhook יכולים להישאר.
