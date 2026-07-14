"use client";

import { type JSX, useEffect, useState } from "react";

type OS = "windows" | "mac" | "android" | "other";

const CDN = "https://pub-a811b9f81e364e2bb4ee8b84ac8bf681.r2.dev/apps";

type Platform = { req: string; href: string; label?: string; badge?: string };

type Product = {
  key: string;
  name: string;
  desc: string;
  platforms: Partial<Record<Exclude<OS, "other">, Platform>>;
};

const PRODUCTS: Product[] = [
  {
    key: "kiosk",
    name: "אפליקציית קיוסק",
    desc: "מסך הזמנה עצמית לדלפק. מזינים מזהה חנות פעם אחת, וזה עולה ישר לקיוסק במסך מלא נעול.",
    platforms: {
      windows: { req: "Windows 7 ומעלה", href: `${CDN}/quickfood-kiosk-Setup-1.0.0.exe` },
      mac: { req: "macOS 11 ומעלה", href: `${CDN}/quickfood-kiosk-1.0.0-universal.dmg` },
    },
  },
  {
    key: "dashboard",
    name: "אפליקציית לוח בקרה",
    desc: "ניהול הזמנות, תפריט והגדרות במסך מלא — על עמדת הקופה או על טאבלט.",
    platforms: {
      windows: { req: "Windows 7 ומעלה", href: `${CDN}/quickfood-dashboard-Setup-1.0.0.exe` },
      mac: { req: "macOS 11 ומעלה", href: `${CDN}/quickfood-dashboard-1.0.0-universal.dmg` },
      android: {
        req: "Android 7 ומעלה",
        href: `${CDN}/quickfood-2.0.0.apk`,
        label: "האפליקציה החדשה 2.0",
        badge: "חדש",
      },
    },
  },
];

const PLATFORM_NAME: Record<Exclude<OS, "other">, string> = {
  windows: "Windows",
  mac: "macOS",
  android: "Android",
};

function WindowsGlyph() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="#000" aria-hidden>
      <path d="M3 5.1 10.4 4v7.3H3zM10.4 12.7V20L3 18.9v-6.2zM11.5 3.85 21 2.5v8.8h-9.5zM21 12.7v8.8l-9.5-1.35V12.7z" />
    </svg>
  );
}

function AppleGlyph() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="#000" aria-hidden>
      <path d="M16.4 12.6c0-2 1.6-3 1.7-3-1-1.3-2.4-1.5-2.9-1.6-1.2-.1-2.4.7-3 .7s-1.6-.7-2.6-.7c-1.3 0-2.6.8-3.3 2-1.4 2.4-.4 6 1 8 .7.9 1.4 2 2.5 2 1 0 1.3-.6 2.5-.6s1.5.6 2.6.6 1.7-.9 2.4-1.9c.7-1 1-2 1-2.1-.1 0-2.4-1-2.4-3.8M14.7 6.3c.5-.7.9-1.6.8-2.6-.8 0-1.7.5-2.3 1.2-.5.6-.9 1.5-.8 2.4.9.1 1.7-.4 2.3-1" />
    </svg>
  );
}

function AndroidGlyph() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="#000" aria-hidden>
      <path d="M6 9.5h12V18a1 1 0 0 1-1 1h-1v2.2a1.3 1.3 0 0 1-2.6 0V19h-2.8v2.2a1.3 1.3 0 0 1-2.6 0V19H7a1 1 0 0 1-1-1zM4.3 9.6a1.3 1.3 0 0 1 1.3 1.3v4.4a1.3 1.3 0 0 1-2.6 0v-4.4a1.3 1.3 0 0 1 1.3-1.3m15.4 0A1.3 1.3 0 0 1 21 10.9v4.4a1.3 1.3 0 0 1-2.6 0v-4.4a1.3 1.3 0 0 1 1.3-1.3M7.7 4.2l-.9-1.6a.3.3 0 0 1 .5-.3l1 1.7a6 6 0 0 1 4.4 0l1-1.7a.3.3 0 1 1 .5.3l-.9 1.6A5.3 5.3 0 0 1 17.9 8.6H6.1a5.3 5.3 0 0 1 1.6-4.4M9.5 6.6a.65.65 0 1 0 0-1.3.65.65 0 0 0 0 1.3m5 0a.65.65 0 1 0 0-1.3.65.65 0 0 0 0 1.3" />
    </svg>
  );
}

const GLYPHS: Record<Exclude<OS, "other">, () => JSX.Element> = {
  windows: WindowsGlyph,
  mac: AppleGlyph,
  android: AndroidGlyph,
};

export function DownloadCards() {
  const [detected, setDetected] = useState<OS>("other");

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    const platform = (navigator.platform || "").toLowerCase();
    if (/android/.test(ua)) setDetected("android");
    else if (/win/.test(ua) || /win/.test(platform)) setDetected("windows");
    else if (/mac/.test(ua) || /mac/.test(platform)) setDetected("mac");
    else setDetected("other");
  }, []);

  return (
    <div className="grid gap-5 sm:grid-cols-2 not-prose">
      {PRODUCTS.map((product) => {
        const keys = Object.keys(product.platforms) as (keyof typeof product.platforms)[];
        return (
          <div
            key={product.key}
            className="flex flex-col gap-4 rounded-2xl border-2 border-black bg-white p-6 shadow-[0_4px_0_#000]"
          >
            <div>
              <div className="text-lg font-black">{product.name}</div>
              <p className="mt-1 text-sm leading-relaxed text-black/60">{product.desc}</p>
            </div>
            <div className="mt-auto flex flex-col gap-2.5">
              {keys.map((key) => {
                const plat = product.platforms[key]!;
                const Glyph = GLYPHS[key];
                const recommended = detected === key;
                return (
                  <a
                    key={key}
                    href={plat.href}
                    className={`flex items-center gap-3 rounded-xl border-2 border-black bg-[#FFF2C9] px-4 py-3 transition hover:bg-[#F8CB1E] active:translate-y-px ${
                      recommended ? "ring-4 ring-[#F8CB1E]/60" : ""
                    }`}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 border-black bg-white">
                      <Glyph />
                    </span>
                    <span className="flex-1 text-right">
                      <span className="flex items-center gap-1.5 text-sm font-black">
                        {plat.label ?? PLATFORM_NAME[key]}
                        {plat.badge && (
                          <span className="rounded-md border-2 border-black bg-[#F8CB1E] px-1.5 py-px text-[10px] font-black">
                            {plat.badge}
                          </span>
                        )}
                      </span>
                      <span className="block text-[11px] font-bold text-black/55">{plat.req}</span>
                    </span>
                    <span className="text-xs font-black text-black/70">
                      {recommended ? "מומלץ · הורדה" : "הורדה"}
                    </span>
                  </a>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
