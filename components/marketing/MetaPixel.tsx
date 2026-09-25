"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { FB_PIXEL_ID, isTrackablePage } from "@/lib/fb/config";
import { useHostname } from "@/lib/hooks/use-hostname";
import { pageview, trackCustom } from "@/lib/fb/pixel";

function PixelEvents() {
  const pathname = usePathname();

  useEffect(() => {
    if (isTrackablePage(pathname, location.hostname)) pageview();
  }, [pathname]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const el = e.target as HTMLElement | null;
      const link = el?.closest?.<HTMLAnchorElement>("a[href]");
      if (!link) return;
      const href = link.getAttribute("href") ?? "";
      if (/^\/signup|\/\/[^/]*quickfood\.co\.il\/signup/.test(href)) {
        trackCustom("ClickSignup", { source: location.pathname });
      }
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}

export function MetaPixel() {
  const pathname = usePathname();
  const host = useHostname();

  if (!FB_PIXEL_ID || !isTrackablePage(pathname, host)) return null;

  return (
    <>
      <Script id="fb-pixel-base" strategy="afterInteractive">
        {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');fbq('init','${FB_PIXEL_ID}');`}
      </Script>
      <PixelEvents />
    </>
  );
}
