import type { Metadata, Viewport } from "next";
import { Noto_Sans_Hebrew, Pacifico } from "next/font/google";
import "./globals.css";
import { RouteProgress } from "@/components/shared/RouteProgress";
import { ScrollToTop } from "@/components/shared/ScrollToTop";

const notoHebrew = Noto_Sans_Hebrew({
  subsets: ["hebrew", "latin"],
  // 300 + 900 added so light captions and the bold V2 sidebar /
  // headlines render at the actual weight instead of falling back
  // to the nearest available (300 → 400, 900 → 800).
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-noto-hebrew",
  display: "swap",
});

const pacifico = Pacifico({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-pacifico-src",
  display: "swap",
});

const SITE_URL = "https://quickfood.co.il";
const SITE_DESCRIPTION =
  "QuickFood (קוויקפוד) - אתר הזמנות משלך לצד וולט. הלקוחות הקבועים שלך מזמינים ישירות אצלך, על הדומיין שלך, עם תוספות, גדלים, מעקב חי ו-וואטסאפ מהמספר שלך. ₪299 לחודש (מחיר קבוע לכל החיים) ו-0.5% להזמנה. 7 ימים ניסיון, ללא כרטיס אשראי.";

// Organization + WebSite + SoftwareApplication JSON-LD. Emitted on every
// page (via RootLayout) so branded searches ("קוויקפוד", "QuickFood")
// reliably get a knowledge-panel-eligible Organization result, and the
// site itself is indexed with the WebSite type for sitelinks/search-box
// eligibility. SoftwareApplication gives Google the "platform" framing
// so we surface in queries like "מערכת הזמנות לפיצרייה".
const ORG_SCHEMA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "QuickFood",
      alternateName: ["קוויקפוד", "קוויק פוד", "Quick Food", "QuickFood IL"],
      url: SITE_URL,
      logo: `${SITE_URL}/quickfood-mark.png`,
      sameAs: [],
      areaServed: "IL",
      slogan: "אתר הזמנות משלך - לצד וולט",
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "QuickFood",
      alternateName: ["קוויקפוד", "קוויק פוד"],
      inLanguage: "he-IL",
      description: SITE_DESCRIPTION,
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#software`,
      name: "QuickFood",
      alternateName: ["קוויקפוד"],
      operatingSystem: "Web, iOS, Android",
      applicationCategory: "BusinessApplication",
      applicationSubCategory: "Restaurant Online Ordering Platform",
      url: SITE_URL,
      inLanguage: "he-IL",
      offers: {
        "@type": "Offer",
        priceCurrency: "ILS",
        price: "299",
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: "299",
          priceCurrency: "ILS",
          unitCode: "MON",
          referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "MON" },
        },
        category: "SubscriptionPlan",
      },
    },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "QuickFood - חנות אונליין למסעדה שלך",
    template: "%s · QuickFood",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "אפליקציית הזמנות למסעדה",
    "מערכת הזמנות לפיצרייה",
    "מערכת הזמנות להמבורגרייה",
    "מערכת הזמנות לסושייה",
    "מערכת הזמנות לשווארמייה",
    "אתר הזמנות למסעדה",
    "אתר משלוחים למסעדה",
    "חנות אונליין למסעדה",
    "QuickFood",
    "קוויקפוד",
    "קוויק פוד",
    "Quick Food",
    "פלטפורמת הזמנות אוכל",
    "תפריט דיגיטלי",
    "אתר משלך למסעדה",
    "אתר הזמנות לצד וולט",
    "מערכת הזמנות בעברית",
    "ניהול שליחים למסעדה",
    "מערכת ניהול מסעדה",
  ],
  authors: [{ name: "QuickFood" }],
  openGraph: {
    type: "website",
    locale: "he_IL",
    url: SITE_URL,
    siteName: "QuickFood",
    title: "QuickFood - חנות אונליין למסעדה שלך",
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "QuickFood - חנות אונליין למסעדה שלך",
    description: SITE_DESCRIPTION,
  },
  alternates: {
    canonical: SITE_URL,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
};

export const viewport: Viewport = {
  themeColor: "#F8CB1E",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="he"
      dir="rtl"
      className={`${notoHebrew.variable} ${pacifico.variable} h-full`}
    >
      <body className="min-h-full flex flex-col bg-qf-bg text-qf-ink">
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_SCHEMA) }}
        />
        <RouteProgress />
        <ScrollToTop />
        {children}
      </body>
    </html>
  );
}
