import Script from "next/script";

const A11Y_KEY = "5ezqwew2ypzj38js";

const A11Y_CONFIG = {
  enabled: true,
  key: A11Y_KEY,
  language: "he",
  position: "bottom-left",
  accentColor: "#facb1e",
  buttonShape: "circle",
  buttonSize: 43,
  offsetX: 26,
  offsetY: 85,
  hideButton: false,
  features: [
    { id: "profile-seizure", category: "profiles", label: "מצב בטוח (אפילפסיה)" },
    { id: "profile-vision", category: "profiles", label: "לקויי ראייה" },
    { id: "profile-adhd", category: "profiles", label: "ריכוז וקשב (ADHD)" },
    { id: "profile-cognitive", category: "profiles", label: "למידה / קוגניטיבי" },
    { id: "profile-blind", category: "profiles", label: "התאמה לקוראי מסך" },
    { id: "profile-motor", category: "profiles", label: "ניווט במקלדת" },
    { id: "contrast-high", category: "color", label: "ניגודיות גבוהה" },
    { id: "contrast-invert", category: "color", label: "היפוך צבעים" },
    { id: "contrast-dark", category: "color", label: "מצב כהה" },
    { id: "contrast-light", category: "color", label: "מצב בהיר" },
    { id: "grayscale", category: "color", label: "גווני אפור" },
    { id: "monochrome", category: "color", label: "שחור-לבן" },
    { id: "saturation-low", category: "color", label: "רוויה נמוכה" },
    { id: "saturation-high", category: "color", label: "רוויה גבוהה" },
    { id: "font-size", category: "text", label: "התאמת גודל גופן" },
    { id: "line-height", category: "text", label: "ריווח שורות" },
    { id: "letter-spacing", category: "text", label: "ריווח בין אותיות" },
    { id: "word-spacing", category: "text", label: "ריווח בין מילים" },
    { id: "readable-font", category: "text", label: "גופן קריא" },
    { id: "dyslexic-font", category: "text", label: "גופן לדיסלקציה" },
    { id: "text-align", category: "text", label: "יישור טקסט" },
    { id: "reading-guide", category: "reading", label: "מדריך קריאה" },
    { id: "reading-mask", category: "reading", label: "מסכת קריאה" },
    { id: "highlight-links", category: "reading", label: "הדגשת קישורים" },
    { id: "highlight-headings", category: "reading", label: "הדגשת כותרות" },
    { id: "highlight-focus", category: "reading", label: "הדגשת מיקוד" },
    { id: "hide-images", category: "reading", label: "הסתרת תמונות" },
    { id: "stop-animations", category: "reading", label: "עצירת אנימציות" },
    { id: "cursor-big-light", category: "orientation", label: "סמן גדול בהיר" },
    { id: "cursor-big-dark", category: "orientation", label: "סמן גדול כהה" },
    { id: "tooltips", category: "orientation", label: "הצגת תיאורים (alt/title)" },
    { id: "tts", category: "tools", label: "הקראת טקסט" },
    { id: "skip-links", category: "tools", label: "דילוג לתוכן" },
  ],
  statementUrl: `https://quick-accessibility.vercel.app/s/${A11Y_KEY}`,
};

export function AccessibilityWidget() {
  return (
    <>
      <Script id="a11y-config" strategy="afterInteractive">
        {`window.__A11Y=window.__A11Y||{};window.__A11Y[${JSON.stringify(A11Y_KEY)}]=${JSON.stringify(A11Y_CONFIG)};`}
      </Script>
      <Script
        src="https://quick-accessibility.vercel.app/widget/v1.js"
        data-a11y-key={A11Y_KEY}
        strategy="afterInteractive"
      />
    </>
  );
}
