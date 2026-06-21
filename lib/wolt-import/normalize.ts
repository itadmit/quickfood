const BLUE_HEARTS = /[\u{1FA75}\u{1F499}]/gu;
const YELLOW_HEART = "\u{1F49B}";

export function cleanImportedText(input: string | null | undefined): string {
  if (!input) return "";
  let s = input;

  s = s.replace(BLUE_HEARTS, YELLOW_HEART);

  s = s.replace(/\bwolt\b/giu, " ");
  s = s.replace(/(^|[^\p{L}])וולט(?=$|[^\p{L}])/gu, "$1 ");

  s = s.replace(/\s*·\s*·\s*/g, " · ");
  s = s.replace(/(^|\s)·(\s|$)/g, "$1$2");
  s = s.replace(/\s{2,}/g, " ");
  s = s.replace(/^[\s·]+|[\s·]+$/g, "");

  return s.trim();
}

export function cleanImportedName(input: string | null | undefined): string {
  const cleaned = cleanImportedText(input);
  return cleaned || (input ?? "").trim();
}
