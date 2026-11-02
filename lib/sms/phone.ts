/** Accept local mobiles and their +972 / 00972 / 972 equivalents. */
export function normalizeSmsPhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00972")) digits = "0" + digits.slice(5);
  else if (digits.startsWith("972")) digits = "0" + digits.slice(3);
  return digits;
}
