import type { Metadata } from "next";

// The /ads/* variants are paid-campaign landing pages. They target the same
// queries as the homepage ("אתר הזמנות למסעדות"), so letting Google index
// them splits the homepage's signal between five near-identical pages.
// Paid traffic reaches them by direct link; organic never should.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
