"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { GA_MEASUREMENT_ID } from "@/lib/ga/config";
import { isMarketingPath } from "@/lib/fb/config";
import { pageview, gaEvent } from "@/lib/ga/gtag";

function GaEvents() {
  const pathname = usePathname();
  const initial = useRef(true);

  // gtag('config') already sends the first page_view, so skip the initial
  // mount and only fire on subsequent client-side navigations.
  useEffect(() => {
    if (initial.current) {
      initial.current = false;
      return;
    }
    if (isMarketingPath(pathname)) pageview(pathname);
  }, [pathname]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const el = e.target as HTMLElement | null;
      const link = el?.closest?.('a[href^="/signup"]');
      if (link) gaEvent("signup_cta_click", { source: location.pathname });
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}

export function GoogleAnalytics() {
  const pathname = usePathname();
  if (!GA_MEASUREMENT_ID || !isMarketingPath(pathname)) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_MEASUREMENT_ID}');`}
      </Script>
      <GaEvents />
    </>
  );
}
