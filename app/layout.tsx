import type { Metadata } from "next";
import { Noto_Sans_Hebrew, Pacifico } from "next/font/google";
import "./globals.css";
import { RouteProgress } from "@/components/shared/RouteProgress";

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

export const metadata: Metadata = {
  title: "QuickFood",
  description: "פלטפורמת SaaS למסעדות ופיצריות — Quickshop",
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
        {children}
      </body>
    </html>
  );
}
