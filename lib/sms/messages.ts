/** Safe customer-facing messages. Never expose provider names or credentials. */
export function smsFailureMessage(error: string | null | undefined): string {
  const text = error ?? "";
  if (/sender.*(invalid|approved)|שם.*שולח/i.test(text)) return "זיהוי השולח אינו מאושר. יש לפנות לתמיכה.";
  if (/no_sms_credits|אין יתרת SMS/i.test(text)) return "שירות ההודעות אינו זמין כרגע. יש לפנות לתמיכה.";
  if (/rate.limit|rate_limited/i.test(text)) return "נשלחו יותר מדי בקשות. נסו שוב בעוד דקה.";
  if (/phone|recipient|bad phone format/i.test(text)) return "מספר הטלפון אינו תקין. יש להזין מספר נייד ישראלי.";
  return "שליחת ההודעה נכשלה. נסו שוב מאוחר יותר או פנו לתמיכה.";
}
