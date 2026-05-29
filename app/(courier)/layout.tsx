import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "שליחים · QuickFood",
  manifest: "/manifest-courier.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "שליח QF",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0b1a14",
};

export default function CourierLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      dir="rtl"
      lang="he"
      className="min-h-[100dvh] bg-[#0b1a14] text-[#f3f6f4] [color-scheme:dark]"
    >
      {children}
    </div>
  );
}
