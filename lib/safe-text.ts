const LINK_PATTERNS = [
  /https?:\/\//i,
  /www\./i,
  /\b[a-z0-9-]+\.(com|net|org|co|il|io|me|gg|link|xyz|info|ru|top|shop|store|club|online|site)\b/i,
  /\b(discord|t\.me|telegram|whatsapp\.com|wa\.me|bit\.ly|tinyurl)\b/i,
];

export function hasLinkOrSpam(text: string): boolean {
  const t = (text ?? "").toString();
  return LINK_PATTERNS.some((re) => re.test(t));
}

export function sanitizeMessageName(text: string, fallback = "QuickFood", maxLen = 40): string {
  let t = (text ?? "").toString();
  t = t.replace(/[\r\n\t]+/g, " ");
  t = t.replace(/https?:\/\/\S+/gi, " ");
  t = t.replace(/www\.\S+/gi, " ");
  t = t.replace(/\b[a-z0-9-]+\.(com|net|org|co|il|io|me|gg|link|xyz|info|ru|top|shop|store|club|online|site)\S*/gi, " ");
  t = t.replace(/[*_`~<>]/g, " ");
  t = t.replace(/\s+/g, " ").trim();
  if (t.length > maxLen) t = t.slice(0, maxLen).trim();
  return t.length >= 2 ? t : fallback;
}
