"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/dashboard/settings/branding", label: "פרטי עסק ומותג" },
  { href: "/dashboard/settings/hours", label: "שעות פעילות" },
  { href: "/dashboard/settings/zones", label: "אזורי משלוח" },
  { href: "/dashboard/settings/payments", label: "תשלומים" },
  { href: "/dashboard/settings/checkout", label: "צ׳ק אאוט" },
  { href: "/dashboard/settings/domain", label: "דומיין מותאם" },
  { href: "/dashboard/settings/reviews", label: "ביקורות" },
  { href: "/dashboard/settings/whatsapp", label: "WhatsApp" },
  { href: "/dashboard/settings/sales", label: "מכירות ואפסיילים" },
  { href: "/dashboard/settings/kiosk", label: "קיוסק" },
  { href: "/dashboard/settings/printing", label: "מדפסת קבלות" },
  { href: "/dashboard/settings/webhooks", label: "Webhooks (POS / מדפסות)" },
  { href: "/dashboard/settings/api-keys", label: "מפתחות API" },
  { href: "/dashboard/settings/team", label: "צוות" },
  { href: "/dashboard/settings/legal", label: "תקנון" },
  { href: "/dashboard/settings/advanced", label: "מתקדם" },
];

export function SettingsHeader({ subtitle }: { subtitle: string }) {
  const path = usePathname() || "";
  const active = TABS.find((t) => path.startsWith(t.href)) ?? TABS[0];

  return (
    <section className="rounded-3xl overflow-hidden border-2 border-black shadow-[0_3px_0_#000]">
      <div
        className="relative p-5 lg:p-7"
        style={{ backgroundColor: "#F8CB1E" }}
      >
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.05]"
          style={{
            backgroundImage:
              "radial-gradient(circle, #000 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
          aria-hidden
        />
        <div className="relative">
          <div className="inline-flex items-center gap-2 mb-2.5 text-black/70 text-xs font-semibold">
            <span className="bg-black text-[#F8CB1E] px-2 py-0.5 rounded-md text-[10px] font-black tracking-wide">
              הגדרות
            </span>
            <span>{subtitle}</span>
          </div>
          <h1 className="text-black font-black text-3xl lg:text-4xl leading-[1.1]">
            {active.label}
          </h1>
        </div>
      </div>

      <nav className="bg-white border-t-2 border-black px-2.5 py-2 flex gap-1.5 overflow-x-auto no-scrollbar">
        {TABS.map((tab) => {
          const isActive = path.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap transition border-2",
                isActive
                  ? "bg-black text-[#F8CB1E] border-black"
                  : "bg-white text-black/65 border-transparent hover:bg-black/[0.04] hover:text-black",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </section>
  );
}
