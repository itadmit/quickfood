import type { Metadata, Viewport } from "next";
import { Noto_Sans_Hebrew, Pacifico } from "next/font/google";
import "./globals.css";
import { RouteProgress } from "@/components/shared/RouteProgress";
import { ScrollToTop } from "@/components/shared/ScrollToTop";

const notoHebrew = Noto_Sans_Hebrew({
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "600", "700", "800"],
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
  "חנות אונליין למסעדה שלך — לוגו שלך, צבעים שלך, לקוחות שלך. ₪299 לחודש (נעול לכל החיים) ו-0.5% להזמנה. בלי לחלוק עם החברות הגדולות. 7 ימים ניסיון, ללא כרטיס אשראי.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "QuickFood — חנות אונליין למסעדה שלך",
    template: "%s · QuickFood",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "אפליקציית הזמנות למסעדה",
    "מערכת הזמנות לפיצרייה",
    "חנות אונליין למסעדה",
    "QuickFood",
    "פלטפורמת הזמנות",
    "תפריט דיגיטלי",
    "Wolt חלופה",
    "ten bis חלופה",
    "מערכת הזמנות בעברית",
  ],
  authors: [{ name: "QuickFood" }],
  openGraph: {
    type: "website",
    locale: "he_IL",
    url: SITE_URL,
    siteName: "QuickFood",
    title: "QuickFood — חנות אונליין למסעדה שלך",
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "QuickFood — חנות אונליין למסעדה שלך",
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
        <RouteProgress />
        <ScrollToTop />
        {children}
      </body>
    </html>
  );
}
