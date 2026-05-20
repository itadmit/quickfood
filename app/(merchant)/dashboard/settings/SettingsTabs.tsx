"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/dashboard/settings/branding", label: "מיתוג ועיצוב" },
  { href: "/dashboard/settings/business", label: "פרטי עסק" },
  { href: "/dashboard/settings/hours", label: "שעות פעילות" },
  { href: "/dashboard/settings/zones", label: "אזורי משלוח" },
  { href: "/dashboard/settings/payments", label: "תשלומים" },
  { href: "/dashboard/settings/webhooks", label: "Webhooks (POS / מדפסות)" },
];

export function SettingsTabs() {
  const path = usePathname() || "";
  return (
    <nav className="flex gap-1 overflow-x-auto no-scrollbar border-b border-qf-line-dash">
      {TABS.map((tab) => {
        const active = path.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "px-4 py-2.5 text-sm whitespace-nowrap border-b-2 transition -mb-px",
              active
                ? "border-(--qf-primary) text-(--qf-deep) font-medium"
                : "border-transparent text-qf-ink2 hover:text-qf-ink",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
