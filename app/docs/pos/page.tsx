import { LegalShell } from "@/components/shared/LegalShell";
import { DocsToc } from "./DocsToc";

export const metadata = {
  title: "אינטגרציית קופה - QuickFood",
  description:
    "מדריך אינטגרציה מלא לקופות, מדפסות תרמיות ומערכות חיצוניות: Webhooks אאוטבאונד, API נכנס, אימות, חתימות HMAC, Idempotency, ו-Rate Limits.",
};

export default function PosDocsPage() {
  return (
    <LegalShell
      title="אינטגרציית קופה"
      subtitle="מדריך מלא לחברות קופה, מדפסות תרמיות ומערכות ניהול חיצוניות. הסבר על כל ה-Webhooks שאנחנו שולחים, וכל ה-API שאפשר לקרוא אליו חזרה."
      lastUpdated="2026-05-24"
      chipLabel="QUICKFOOD · DEVELOPER DOCS"
    >
      <DocsToc />

      <section id="overview">
        <h2>1. סקירה כללית</h2>
        <p>
          QuickFood מספקת אינטגרציה דו-כיוונית מלאה: <strong>Webhooks</strong>{" "}
          (אנחנו שולחים אליכם בזמן אמת על כל הזמנה ושינוי סטטוס) ו-{" "}
          <strong>REST API נכנס</strong> (אתם דוחפים חזרה עדכוני סטטוס, מסמנים
          פריטים שאזלו, יוצרים הזמנות ידניות שנכנסו דרך הטלפון). שילוב של שני
          הכיוונים נותן סנכרון מלא בין הקופה למערכת.
        </p>
        <h3>למי המדריך הזה מתאים</h3>
        <ul>
          <li>
            <strong>חברות קופה</strong> - Restigo, Tabit, ResApp, וכל קופה
            עצמאית שצריכה לקבל הזמנות אונליין ולהחזיר סטטוסים מהמטבח.
          </li>
          <li>
            <strong>מדפסות תרמיות</strong> - כל מדפסת/middleware שמדבר HTTP
            יכול להאזין ל-<code>order.created</code> ולהדפיס קבלה אוטומטית.
          </li>
          <li>
            <strong>אוטומציה בלי קוד</strong> - <strong>Make</strong> (לשעבר
            Integromat), <strong>Zapier</strong>, <strong>n8n</strong>,
            <strong>Pipedream</strong>. ה-Webhooks עוטפים כל הזמנה ב-JSON
            רגיל, וה-API פתוח לקריאה דרך HTTP module בכל פלטפורמה.
          </li>
          <li>
            <strong>כלי התראות</strong> - Slack, Telegram, Discord, WhatsApp
            דרך iBot - בדרך כלל מתחברים דרך Make/Zapier (אנחנו דוחפים את
            ה-webhook לזאפיר, הוא מפרק ושולח).
          </li>
          <li>
            <strong>אפליקציות פנימיות</strong> - דשבורד שלכם, BI, חשבוניות,
            CRM. הכל מתחיל מאותו API key.
          </li>
        </ul>
        <p>
          המדריך כתוב למפתח שמתחבר לראשונה - הוא מכסה כל מה שצריך כדי להעביר
          הזמנה ממסעדה לקופה ובחזרה, כולל אבטחה, retry, ודוגמאות קוד.
        </p>
        <div className="docs-callout">
          <strong>טיפ מהשטח:</strong> תתחילו מקצוות. קודם תרשמו webhook ותוודאו
          שאתם מקבלים <code>order.created</code>; אחר כך תוסיפו את ה-PATCH
          status. הסדר הזה חוסך 80% מהבאגים בהטמעה.
        </div>
        <h3>אינטגרציה ב-Make / Zapier בלי קוד</h3>
        <p>
          לא חייבים לכתוב receiver משלכם. ב-Make/Zapier:
        </p>
        <ol>
          <li>
            צרו <em>scenario</em> חדש שמתחיל ב-{" "}
            <strong>Webhook ← Custom webhook</strong>. הם ייצרו לכם URL ייחודי.
          </li>
          <li>
            הדביקו את ה-URL בדשבורד של QuickFood (<em>הגדרות ← Webhooks</em>),
            סמנו את האירועים, ושמרו.
          </li>
          <li>
            לחצו <em>Test</em> כדי לראות את ה-payload הראשון נכנס.
          </li>
          <li>
            אחרי האירוע - הוסיפו modules כרצונכם: HTTP POST לקופה שלכם,
            הודעה ל-Slack, שורה ב-Google Sheets, וכו'.
          </li>
        </ol>
        <p>
          <strong>אימות החתימה ב-Make/Zapier:</strong> אם אתם מאמינים שאף אחד
          לא יודע את ה-URL שלכם, אפשר לדלג; לפרודקשן רציני מומלץ להוסיף
          step ראשון של <em>Tools ← Set Variable</em> שמחשב HMAC ומשווה ל-
          <code>X-QuickFood-Signature</code>. ב-Make יש module מובנה ל-HMAC.
        </p>
      </section>

      <section id="auth">
        <h2>2. אימות</h2>
        <p>
          כל קריאה ל-<code>/api/v1/merchant/*</code> דורשת כותרת{" "}
          <code>Authorization</code> עם API key שהונפק על ידי המסעדה בדשבורד.
        </p>
        <pre><code>Authorization: Bearer qfk_&lt;prefix&gt;_&lt;secret&gt;</code></pre>
        <p>
          המפתח מתחיל תמיד ב-<code>qfk_</code> ואחריו prefix של 12 תווים
          וסיומת secret של 48 תווים. ה-secret מאוחסן אצלנו כ-bcrypt hash בלבד
          - אם המסעדה איבדה אותו צריך ליצור חדש ולבטל את הישן.
        </p>
        <h3>איך המסעדה מנפיקה מפתח</h3>
        <ol>
          <li>נכנסים לדשבורד ← <strong>הגדרות ← מפתחות API</strong></li>
          <li>לוחצים <em>צור מפתח חדש</em>, נותנים שם תיאורי ובוחרים תוקף</li>
          <li>המפתח מוצג <strong>פעם אחת בלבד</strong> - מעתיקים ושומרים ב-vault</li>
          <li>שולחים אותכם - אתם שומרים אותו בצד שלכם</li>
        </ol>
        <h3>קודי שגיאה של אימות</h3>
        <table>
          <thead>
            <tr><th>HTTP</th><th>code</th><th>מתי</th></tr>
          </thead>
          <tbody>
            <tr><td>401</td><td><code>unauthorized</code></td><td>אין כותרת <code>Authorization</code>, או המפתח לא תקף / פג תוקף</td></tr>
            <tr><td>403</td><td><code>forbidden</code></td><td>המפתח תקף אבל אין לו הרשאה לפעולה (למשל refund דורש <code>owner</code> או <code>manager</code>)</td></tr>
          </tbody>
        </table>
        <div className="docs-callout docs-callout--warn">
          <strong>אבטחה:</strong> אל תכניסו את המפתח לקוד שירוץ בדפדפן. הוא
          מיועד לשרת-לשרת בלבד. אם נחשף - בטלו מיד מהדשבורד וייצרו חדש.
        </div>
      </section>

      <section id="errors">
        <h2>3. פורמט שגיאות</h2>
        <p>
          כל שגיאה בכל endpoint מחזירה JSON עם המבנה הבא. שדה <code>field</code>{" "}
          נוסף רק כשמדובר בשגיאת ולידציה על שדה ספציפי.
        </p>
        <pre><code>{`{
  "error": {
    "code": "invalid_transition",
    "message": "מעבר לא חוקי: preparing ← pending",
    "field": "status"
  }
}`}</code></pre>
        <h3>קודים נפוצים</h3>
        <table>
          <thead><tr><th>HTTP</th><th>code</th><th>משמעות</th></tr></thead>
          <tbody>
            <tr><td>401</td><td><code>unauthorized</code></td><td>אין/לא תקין <code>Authorization</code></td></tr>
            <tr><td>403</td><td><code>forbidden</code></td><td>אין הרשאה לפעולה</td></tr>
            <tr><td>404</td><td><code>not_found</code></td><td>משאב לא קיים</td></tr>
            <tr><td>409</td><td><code>conflict</code></td><td>שגיאת עסקית (החזר כפול, Idempotency-Key עם body שונה)</td></tr>
            <tr><td>409</td><td><code>invalid_transition</code></td><td>מעבר סטטוס שלא מותר ב-state machine</td></tr>
            <tr><td>422</td><td><code>validation_error</code></td><td>גוף בקשה לא עומד בסכמה (יש שדה <code>field</code>)</td></tr>
            <tr><td>429</td><td><code>rate_limited</code></td><td>חרגתם מהגג של 600 קריאות לדקה</td></tr>
            <tr><td>500</td><td><code>internal_error</code></td><td>שגיאה אצלנו. אם חוזרת - פתחו תקלה</td></tr>
          </tbody>
        </table>
      </section>

      <section id="webhooks">
        <h2>4. Webhooks (אאוטבאונד)</h2>
        <p>
          כשמשהו קורה - הזמנה חדשה, שינוי סטטוס, ביטול, refund - אנחנו שולחים
          POST ל-URL שהגדרתם, עם גוף JSON וחתימת HMAC-SHA256. אתם מחזירים 2xx
          תוך 8 שניות. שגיאה ← ננסה שוב לפי לוח הזמנים בהמשך.
        </p>

        <h3>4.1 הגדרת endpoint</h3>
        <p>
          המסעדה רושמת את כתובת ה-receiver שלכם דרך הדשבורד (<strong>הגדרות ←
          Webhooks</strong>) או דרך ה-API:
        </p>
        <pre><code>{`POST /api/v1/merchant/webhooks/endpoints
Authorization: Bearer qfk_...
Content-Type: application/json

{
  "url": "https://pos.example.co.il/quickfood/webhook",
  "events": ["order.created", "order.status_changed", "order.cancelled", "order.refunded"],
  "active": true
}`}</code></pre>
        <p>תשובה (201) - שמרו את ה-<code>secret</code>, הוא מוצג פעם אחת בלבד:</p>
        <pre><code>{`{
  "endpoint": {
    "id": "uuid",
    "url": "...",
    "events": ["..."],
    "active": true,
    "secret": "64-char-hex-string",
    "created_at": "2026-05-24T..."
  }
}`}</code></pre>

        <h3>4.2 כותרות שנשלחות בכל webhook</h3>
        <table>
          <thead><tr><th>Header</th><th>תפקיד</th></tr></thead>
          <tbody>
            <tr><td><code>Content-Type</code></td><td><code>application/json</code></td></tr>
            <tr><td><code>X-QuickFood-Signature</code></td><td>חתימת HMAC: <code>t=&lt;unix&gt;,v1=&lt;hex&gt;</code></td></tr>
            <tr><td><code>X-QuickFood-Event</code></td><td>סוג האירוע (לדוגמה <code>order.created</code>)</td></tr>
            <tr><td><code>X-QuickFood-Delivery</code></td><td>UUID של ה-delivery - להשתמש בו כ-<strong>dedup key</strong></td></tr>
          </tbody>
        </table>

        <h3>4.3 אימות חתימה</h3>
        <p>
          אנחנו חותמים בשיטה של Stripe: HMAC-SHA256 על המחרוזת{" "}
          <code>{`${"<timestamp>"}.${"<raw_body>"}`}</code> עם ה-secret שקיבלתם
          ביצירת ה-endpoint. הקפידו להשתמש ב-<strong>raw body</strong> לפני{" "}
          <code>JSON.parse</code> - אחרת רווחים וסדר מפתחות ישברו את האימות.
        </p>
        <pre><code>{`const crypto = require("crypto");

function verify(rawBody, header, secret) {
  const parts = Object.fromEntries(
    header.split(",").map((p) => p.split("="))
  );
  const t = Number(parts.t);
  if (Math.abs(Date.now() / 1000 - t) > 300) return false; // 5-min replay window
  const expected = crypto
    .createHmac("sha256", secret)
    .update(\`\${t}.\${rawBody}\`)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(parts.v1)
  );
}`}</code></pre>
        <div className="docs-callout docs-callout--warn">
          <strong>חובה:</strong> אם החתימה לא תקפה, החזירו 401 ואל תעבדו את
          ה-payload. בקשה לא חתומה = לא מאיתנו. (התוקף יכול לזייף את כל גוף
          ה-JSON אבל לא את החתימה, כי אין לו את ה-secret.)
        </div>

        <h3>4.4 Envelope אחיד</h3>
        <p>כל payload עטוף בעטיפה הזו - שדה <code>data</code> משתנה לפי האירוע:</p>
        <pre><code>{`{
  "id": "delivery-uuid",
  "event": "order.created",
  "created_at": "2026-05-24T10:30:45.123Z",
  "tenant_id": "merchant-uuid",
  "data": { ... payload ספציפי לאירוע ... }
}`}</code></pre>

        <h3>4.5 סוגי אירועים</h3>

        <details open>
          <summary><code>order.created</code> - הזמנה חדשה אושרה</summary>
          <p>
            נשלח כשהזמנה נכנסה למצב <code>confirmed</code>. למזומן - מיידי.
            לאשראי - אחרי שה-callback של תשלום חזר בהצלחה.
          </p>
          <pre><code>{`{
  "order_id": "uuid",
  "number": "PIZZA-000123",
  "total": 10850,
  "method": "delivery",
  "items": [
    {
      "name": "פיצה מרגריטה",
      "quantity": 2,
      "total": 6800,
      "size": "לארג'"
    }
  ]
}`}</code></pre>
        </details>

        <details>
          <summary><code>order.status_changed</code> - מעבר בין סטטוסים</summary>
          <p>
            נשלח לכל מעבר <em>חוץ</em> מ-<code>cancelled</code> ו-
            <code>refunded</code> (להם יש אירועים ייעודיים).
          </p>
          <pre><code>{`{
  "order_id": "uuid",
  "from": "confirmed",
  "to": "preparing",
  "changed_at": "2026-05-24T10:31:00.000Z"
}`}</code></pre>
        </details>

        <details>
          <summary><code>order.cancelled</code> - הזמנה בוטלה</summary>
          <pre><code>{`{
  "order_id": "uuid",
  "reason": "out_of_stock",
  "cancelled_at": "2026-05-24T10:35:00.000Z"
}`}</code></pre>
        </details>

        <details>
          <summary><code>order.refunded</code> - סומן כהוחזר</summary>
          <p>
            לאשראי - ההחזר הכספי בפועל קורה ידנית בפאנל של Grow Payments. ה-
            webhook הזה רק מסמן את הכוונה ב-DB.
          </p>
          <pre><code>{`{
  "order_id": "uuid",
  "number": "PIZZA-000123",
  "amount": 10850,
  "payment_method": "card",
  "reason": "customer_complaint"
}`}</code></pre>
        </details>

        <details>
          <summary><code>order.ready_for_print</code> - שמור לעתיד</summary>
          <p>
            יישלח כשנוסיף תמיכה במדפסות תרמיות (סטטוס <code>ready</code> במטבח
            ידחוף את הקבלה ל-printer). לא משודר כרגע - מומלץ להאזין כבר היום
            כדי שתהיו מוכנים.
          </p>
        </details>

        <h3>4.6 מדיניות Retry</h3>
        <p>אם החזרתם משהו שאיננו 2xx, או שלא הגבתם תוך 8 שניות, ננסה שוב:</p>
        <table>
          <thead><tr><th>ניסיון</th><th>זמן מהאירוע</th></tr></thead>
          <tbody>
            <tr><td>1</td><td>מיידי</td></tr>
            <tr><td>2</td><td>+1 דקה</td></tr>
            <tr><td>3</td><td>+5 דקות</td></tr>
            <tr><td>4</td><td>+15 דקות</td></tr>
            <tr><td>5</td><td>+60 דקות</td></tr>
            <tr><td>6</td><td>+6 שעות</td></tr>
          </tbody>
        </table>
        <p>
          אחרי 6 ניסיונות שנכשלו ← סטטוס <code>abandoned</code>. המסעדה רואה
          את ה-delivery בדשבורד עם כפתור <em>Retry</em> ידני. אנחנו לא
          מוחקים deliveries כושלים - היסטוריה מלאה זמינה תמיד.
        </p>
      </section>

      <section id="orders-api">
        <h2>5. API הזמנות (נכנס)</h2>

        <h3>5.1 רשימת הזמנות</h3>
        <pre><code>GET /api/v1/merchant/orders?status=active&page=1&per_page=30</code></pre>
        <p>פרמטרים אופציונליים:</p>
        <ul>
          <li><code>status</code>: <code>active</code> (כל מה שבעבודה), או ערך OrderStatus ספציפי (<code>pending</code>, <code>confirmed</code>, ...)</li>
          <li><code>page</code>: דיפולט 1</li>
          <li><code>per_page</code>: דיפולט 30, מקסימום 100</li>
        </ul>

        <h3>5.2 שליפת הזמנה בודדת</h3>
        <pre><code>GET /api/v1/merchant/orders/{`{id}`}</code></pre>
        <p>מחזיר את אותו shape של פריט ברשימה, עטוף ב-<code>{"{ \"order\": ... }"}</code>.</p>
        <pre><code>{`{
  "order": {
    "id": "uuid",
    "number": "PIZZA-000123",
    "status": "confirmed",
    "method": "delivery",
    "customer": { "id": "uuid", "first_name": "אסף", "last_name": "כהן", "name": "אסף כהן", "phone": "+972501234567" },
    "subtotal": 9800,
    "delivery_fee": 1500,
    "service_fee": 0,
    "tip": 0,
    "discount": 450,
    "total": 10850,
    "payment_method": "card",
    "payment_status": "paid",
    "customer_notes": "בלי בצל",
    "created_at": "2026-05-24T10:30:00.000Z",
    "confirmed_at": "2026-05-24T10:30:12.000Z",
    "items": [
      {
        "id": "uuid",
        "name": "פיצה מרגריטה",
        "quantity": 2,
        "unit_price": 3400,
        "total_price": 6800,
        "size": "לארג'",
        "options": { "toppings": [{ "id": "uuid", "name": "זיתים", "price_delta": 500 }] },
        "notes": null
      }
    ]
  }
}`}</code></pre>
        <div className="docs-callout">
          <strong>שימו לב:</strong> כל שדות הכסף הם <strong>אגורות (ILS cents)</strong>.
          <code>10850</code> = ₪108.50. לחלק ב-100 לתצוגה.
        </div>

        <h3>5.3 עדכון סטטוס (push מהקופה אלינו)</h3>
        <pre><code>{`PATCH /api/v1/merchant/orders/{id}/status
Content-Type: application/json

{
  "status": "preparing",
  "courier_id": "uuid"   // אופציונלי, רק במעבר ל-out_for_delivery
}`}</code></pre>
        <h4>State machine</h4>
        <table>
          <thead><tr><th>מ-</th><th>אל</th></tr></thead>
          <tbody>
            <tr><td><code>pending</code></td><td><code>confirmed</code>, <code>preparing</code>, <code>cancelled</code></td></tr>
            <tr><td><code>confirmed</code></td><td><code>preparing</code>, <code>cancelled</code></td></tr>
            <tr><td><code>preparing</code></td><td><code>in_oven</code>, <code>ready</code>, <code>cancelled</code></td></tr>
            <tr><td><code>in_oven</code></td><td><code>ready</code>, <code>cancelled</code></td></tr>
            <tr><td><code>ready</code></td><td><code>out_for_delivery</code>, <code>delivered</code>, <code>cancelled</code></td></tr>
            <tr><td><code>out_for_delivery</code></td><td><code>delivered</code>, <code>cancelled</code></td></tr>
            <tr><td><code>delivered</code></td><td><code>refunded</code></td></tr>
          </tbody>
        </table>
        <p>
          מעבר לא חוקי מחזיר 409 עם <code>invalid_transition</code>. ביטול
          הזמנה = PATCH עם <code>status: &quot;cancelled&quot;</code> (אין endpoint
          נפרד לביטול).
        </p>
        <div className="docs-callout docs-callout--warn">
          <strong>זהירות מ-loop:</strong> כל PATCH משדר webhook חזרה למנויים
          - כולל אליכם. השתמשו ב-<code>X-QuickFood-Delivery</code> ל-dedup
          ובדקו שאתם לא מגיבים לאירוע שאתם בעצמכם יצרתם.
        </div>

        <h3>5.4 החזר כספי</h3>
        <pre><code>{`POST /api/v1/merchant/orders/{id}/refund
Content-Type: application/json

{
  "reason": "מוצר חסר במלאי",   // אופציונלי, עד 500 תווים
  "cancel_workflow": false       // אם true - גם מסמן cancelledAt
}`}</code></pre>
        <p>
          דורש role <code>owner</code> או <code>manager</code> - מפתחות API
          שניתנו לקופה לרוב לא יוכלו לבצע. השאירו את זה למסעדה לעשות ידנית
          בדשבורד.
        </p>
        <p>תשובה כוללת <code>money_action_required</code>:</p>
        <pre><code>{`{
  "ok": true,
  "payment_method": "card",
  "money_action_required": "החזר את הסכום ידנית בלוח הבקרה של Grow Payments"
}`}</code></pre>

        <h3>5.5 יצירת הזמנה ידנית (POS ← QuickFood)</h3>
        <p>
          להזמנות שהקופה קיבלה בטלפון/באולם ורוצה להזריק למערכת:
        </p>
        <pre><code>{`POST /api/v1/merchant/orders/manual
Content-Type: application/json
Idempotency-Key: 8e3a7f24-...

{
  "customer_phone": "+972501234567",
  "customer_name": "אסף כהן",
  "method": "pickup",
  "address": "הרצל 12 רחובות",
  "payment_method": "cash",
  "notes": "בלי חריף",
  "lines": [
    {
      "item_id": "uuid",
      "quantity": 2,
      "size_id": "uuid",
      "option_ids": ["uuid", "uuid"]
    }
  ]
}`}</code></pre>
        <p>תשובה (201):</p>
        <pre><code>{`{
  "order": {
    "id": "uuid",
    "number": "PIZZA-000124",
    "status": "pending",
    "total": 10850
  }
}`}</code></pre>
      </section>

      <section id="menu-api">
        <h2>6. API תפריט</h2>

        <h3>6.1 קטגוריות</h3>
        <pre><code>GET /api/v1/merchant/menu/categories</code></pre>
        <pre><code>{`{
  "categories": [
    { "id": "uuid", "name": "פיצות", "icon": "pizza", "color": "#E11D48", "position": 1, "active": true }
  ]
}`}</code></pre>

        <h3>6.2 רשימת פריטים</h3>
        <pre><code>GET /api/v1/merchant/menu/items?category_id=uuid&available=true&q=פיצה&page=1&per_page=50</code></pre>
        <p>כל הפרמטרים אופציונליים. <code>per_page</code> דיפולט 50, מקסימום 200.</p>

        <h3>6.3 פריט בודד עם כל המודיפיירים</h3>
        <pre><code>GET /api/v1/merchant/menu/items/{`{id}`}</code></pre>
        <pre><code>{`{
  "item": {
    "id": "uuid",
    "name": "פיצה מרגריטה",
    "description": "...",
    "category_id": "uuid",
    "base_price": 3400,
    "prep_minutes": 12,
    "image_url": "https://...",
    "images": ["https://..."],
    "available": true,
    "sku": "PIZ-001",
    "stock_remaining": null,
    "available_from": 660,      // דקות מחצות (11:00)
    "available_to": 1380,       // 23:00
    "available_days": 127,      // 7-bit mask (כל הימים)
    "sizes": [
      { "id": "uuid", "code": "M", "name": "בינוני", "price_delta": 0, "is_default": true },
      { "id": "uuid", "code": "L", "name": "לארג'", "price_delta": 1500, "is_default": false }
    ],
    "option_groups": [
      {
        "id": "uuid",
        "name": "תוספות",
        "type": "multi",
        "required": false,
        "min_select": 0,
        "max_select": 5,
        "included_free": 2,
        "options": [
          { "id": "uuid", "name": "זיתים", "price_delta": 500, "available": true, "image_url": null }
        ]
      }
    ]
  }
}`}</code></pre>

        <h3>6.4 הגדרת זמינות מהקופה (sold-out)</h3>
        <pre><code>{`PATCH /api/v1/merchant/menu/items/{id}/availability
Content-Type: application/json

{ "available": false, "stock_remaining": 0 }`}</code></pre>
        <p>
          שימוש טיפוסי: הקופה רואה שפריט אזל מהמלאי - דוחפת{" "}
          <code>available=false</code>. בצד הלקוח הפריט יוצג כאזל מיידית.
        </p>
      </section>

      <section id="idempotency">
        <h2>7. Idempotency</h2>
        <p>
          תקשורת חלשה? Timeout שגרם לכם לנסות שוב? כדי להגן מכפילויות שלחו את
          הכותרת <code>Idempotency-Key</code> עם UUID יחיד לכל פעולה לוגית
          (לא לכל ניסיון).
        </p>
        <pre><code>{`POST /api/v1/merchant/orders/manual
Idempotency-Key: 8e3a7f24-1234-5678-9abc-def012345678
Content-Type: application/json

{ ... body ... }`}</code></pre>
        <h3>איך זה מתנהג</h3>
        <ul>
          <li><strong>בקשה ראשונה:</strong> מבוצעת רגיל, התשובה נשמרת.</li>
          <li><strong>אותו key + אותו body:</strong> מקבלים את התשובה המקורית בחזרה בלי לבצע שוב את הפעולה. הכותרת <code>X-QuickFood-Idempotent-Replay: true</code> תהיה בתגובה.</li>
          <li><strong>אותו key + body שונה:</strong> 409 <code>conflict</code> - הגנה מטעויות באפליקציה.</li>
          <li><strong>תוקף:</strong> 24 שעות מהבקשה הראשונה. אחר כך אותו key יבצע פעולה חדשה.</li>
        </ul>
        <p>
          תומך כרגע ב-<code>POST /orders/manual</code>. בעתיד נוסיף תמיכה
          ב-PATCH הסטטוס וב-refund.
        </p>
      </section>

      <section id="rate-limits">
        <h2>8. Rate Limits</h2>
        <p>
          הגג הנוכחי: <strong>600 קריאות לדקה לכל API key</strong> (= 10
          לשנייה). חריגה מחזירה 429 עם <code>Retry-After</code>.
        </p>
        <pre><code>{`HTTP/1.1 429 Too Many Requests
Retry-After: 12
X-RateLimit-Limit: 600
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 12
Content-Type: application/json

{
  "error": {
    "code": "rate_limited",
    "message": "חרגת ממכסת הקריאות (600/דקה). נסה שוב בעוד 12 שניות."
  }
}`}</code></pre>
        <div className="docs-callout">
          הגג הזה גבוה בהרבה ממה שקופה נורמלית צריכה. אם אתם מתקרבים אליו -
          כנראה שיש לכם loop שלא מסונכרן. תבדקו את ה-dedup על{" "}
          <code>X-QuickFood-Delivery</code>.
        </div>
      </section>

      <section id="cors-ip">
        <h2>9. CORS, IP, ושיקולי רשת</h2>
        <ul>
          <li>
            <strong>CORS:</strong> ה-API <em>לא</em> פתוח לקריאה מדפדפן. כל
            הקריאות חייבות להיות שרת-לשרת.
          </li>
          <li>
            <strong>IP מקור:</strong> webhooks יוצאים מ-Vercel - אין IP קבוע.
            אם אצלכם יש whitelist, צרו קשר ונסכם על proxy ייעודי.
          </li>
          <li>
            <strong>TLS:</strong> רק HTTPS עם תעודה תקפה. webhooks ל-URL שאינו
            HTTPS לא יקבלו אישור ביצירה.
          </li>
          <li>
            <strong>Timeout:</strong> 8 שניות לתגובה. עיבוד כבד צריך לעבור
            ל-queue אצלכם.
          </li>
        </ul>
      </section>

      <section id="conventions">
        <h2>10. מוסכמות נתונים</h2>
        <table>
          <thead><tr><th>שדה</th><th>פורמט</th></tr></thead>
          <tbody>
            <tr><td>כסף (<code>total</code>, <code>amount</code>, <code>price_delta</code>...)</td><td>Int באגורות. ₪10.50 = <code>1050</code></td></tr>
            <tr><td>מטבע</td><td>ILS תמיד (לא נשלח שדה במפורש)</td></tr>
            <tr><td>זמנים</td><td>ISO-8601 UTC (<code>2026-05-24T10:30:45.123Z</code>)</td></tr>
            <tr><td>טלפון</td><td>E.164 (<code>+972501234567</code>) או פורמט ישראלי שיומר</td></tr>
            <tr><td>טקסטים</td><td>UTF-8, יכולים לכלול עברית, אימוג'ים, וסימני פיסוק יוניקוד</td></tr>
            <tr><td>UUIDs</td><td>v4, lowercase, מקפים סטנדרטיים</td></tr>
          </tbody>
        </table>
      </section>

      <section id="checklist">
        <h2>11. צ&apos;ק-ליסט אינטגרציה</h2>

        <h3>שלב 1 - אימות</h3>
        <ul>
          <li>קבלת API key מהמסעדה</li>
          <li>אחסון ב-vault מוצפן, לא בקוד</li>
          <li>בדיקת <code>GET /api/v1/merchant/orders?per_page=1</code> כ-smoke test</li>
        </ul>

        <h3>שלב 2 - קבלת הזמנות</h3>
        <ul>
          <li>רישום webhook endpoint עם 4 האירועים העיקריים</li>
          <li>אימות חתימת HMAC עם <code>raw body</code></li>
          <li>Dedup לפי <code>X-QuickFood-Delivery</code></li>
          <li>החזרת 2xx תוך 8 שניות; עיבוד כבד עובר ל-queue</li>
        </ul>

        <h3>שלב 3 - עדכון חזרה</h3>
        <ul>
          <li><code>PATCH /orders/{`{id}`}/status</code> בכל שלב במטבח</li>
          <li>זיהוי loops - לא להגיב לאירוע שאתם בעצמכם יצרתם</li>
        </ul>

        <h3>שלב 4 - תפריט (אופציונלי)</h3>
        <ul>
          <li>טעינת קטגוריות + פריטים פעם ביום, או cache לפי ה-snapshot שב-<code>order.created</code></li>
        </ul>

        <h3>שלב 5 - מלאי (אם הקופה מנהלת)</h3>
        <ul>
          <li><code>PATCH /menu/items/{`{id}`}/availability</code> כשפריט נגמר</li>
        </ul>

        <h3>שלב 6 - הזמנה ידנית (אם POS מקבל גם הזמנות אופליין)</h3>
        <ul>
          <li><code>POST /orders/manual</code> עם <code>Idempotency-Key</code></li>
        </ul>
      </section>

      <section id="faq">
        <h2>12. שאלות נפוצות</h2>

        <details>
          <summary>קיבלתי webhook אבל מהר מדי - לפני שהדאטא מוכן ב-API?</summary>
          <p>
            לא יקרה. ה-webhook נוצר אחרי שה-DB transaction מסתיים. אם
            <code>GET /orders/{`{id}`}</code> מחזיר 404 על מזהה מ-webhook
            - סימן לבעיה אצלנו (פתחו תקלה).
          </p>
        </details>

        <details>
          <summary>מה קורה אם המסעדה מנפיקה מפתח חדש - הישן מתבטל?</summary>
          <p>
            לא. מפתחות פעילים במקביל. ביטול מפורש מהדשבורד (כפתור{" "}
            <em>בטל</em>) מבטל את המפתח באופן מיידי.
          </p>
        </details>

        <details>
          <summary>איך אני בודק שהחתימה שלי תקפה?</summary>
          <p>
            יש כפתור <em>Test</em> ליד כל endpoint בדשבורד. הוא שולח דוגמת{" "}
            <code>order.created</code> אמיתית עם חתימה תקפה. אם ה-receiver
            שלכם דחה - הבעיה ב-verifier שלכם.
          </p>
        </details>

        <details>
          <summary>אני רואה את אותו אירוע פעמיים - באג?</summary>
          <p>
            לא בהכרח. retries יכולים לשלוח שוב אחרי timeout. תמיד תשתמשו
            ב-<code>X-QuickFood-Delivery</code> ל-dedup - UUID זה ייחודי לכל
            ניסיון delivery נפרד, אז עם dedup אמיתי לא תראו כפילויות.
          </p>
        </details>

        <details>
          <summary>אפשר לקבל webhook על שינוי בתפריט (מחיר/זמינות)?</summary>
          <p>
            עדיין לא. כרגע מומלץ לשלוף את התפריט מחדש בתחילת כל יום, או לסמוך
            על ה-snapshot של פריטים בתוך <code>order.created</code> (שמות
            ומחירים שם משקפים את מה שראה הלקוח בזמן ההזמנה).
          </p>
        </details>

        <details>
          <summary>אני רוצה לבדוק את האינטגרציה - יש סביבת sandbox?</summary>
          <p>
            כל מסעדה היא tenant מבודד - אתם יכולים לבקש מהמסעדה ליצור tenant
            לבדיקות עם תפריט דמה. אין כרגע sandbox ציבורי.
          </p>
        </details>
      </section>

      <section id="support">
        <h2>13. תמיכה</h2>
        <p>
          שאלות אינטגרציה: <a href="mailto:hello@quickfood.co.il">hello@quickfood.co.il</a>.
          תכללו את ה-<code>X-QuickFood-Delivery</code> או <code>order_id</code>{" "}
          הרלוונטי כדי שנוכל לעזור מהר.
        </p>
      </section>
    </LegalShell>
  );
}
