"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { FB_PIXEL_ID, isMarketingPath } from "@/lib/fb/config";
import { pageview, trackCustom } from "@/lib/fb/pixel";

function PixelEvents() {
  const pathname = usePathname();

  useEffect(() => {
    if (isMarketingPath(pathname)) pageview();
  }, [pathname]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const el = e.target as HTMLElement | null;
      const link = el?.closest?.('a[href^="/signup"]');
      if (link) trackCustom("ClickSignup", { source: location.pathname });
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}

export function MetaPixel() {
  const pathname = usePathname();
  if (!FB_PIXEL_ID || !isMarketingPath(pathname)) return null;

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
