"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";

type Tab = "home" | "history" | "profile";

const TABS: Array<{ id: Tab; label: string; href: string }> = [
  { id: "home", label: "בית", href: "/courier/home" },
  { id: "history", label: "היסטוריה", href: "/courier/orders" },
  { id: "profile", label: "פרופיל", href: "/courier/profile" },
];

export function CourierBottomNav({ active }: { active: Tab }) {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 bg-[#0b1a14]/95 backdrop-blur border-t border-white/10">
      <div className="max-w-screen-sm mx-auto grid grid-cols-3 gap-1 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={t.href}
            className={cn(
              "py-2.5 rounded-xl text-sm font-medium text-center transition",
              active === t.id
                ? "bg-white text-[#0b1a14]"
                : "text-white/60 hover:bg-white/5",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
