import type { Metadata } from "next";
import { Heebo, Pacifico } from "next/font/google";
import "./globals.css";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-heebo",
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
      className={`${heebo.variable} ${pacifico.variable} h-full`}
    >
      <body className="min-h-full flex flex-col bg-qf-bg text-qf-ink">
        {children}
      </body>
    </html>
  );
}
