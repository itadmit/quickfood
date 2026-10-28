"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { setStorefrontPixel, sfTrack } from "@/lib/fb/storefront";

/**
 * Loads the STORE'S OWN Meta Pixel on the storefront. Rendered only when the
 * tenant configured a pixel id and only for real customers (never the owner
 * previewing their own store). The platform marketing pixel never loads on
 * `/s/`, so this is the only fbq on the page.
 *
 * The id is registered synchronously on render so cart/checkout/order events
 * fire against the right pixel the moment fbevents.js finishes loading. The
 * initial PageView lives in the inline snippet (queued by fbq); subsequent
 * client-side navigations fire PageView from the effect.
 */
export function StorefrontPixel({ pixelId }: { pixelId: string }) {
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    setStorefrontPixel(pixelId);
    return () => setStorefrontPixel(null);
  }, [pixelId]);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    sfTrack("PageView");
  }, [pathname]);

  return (
    <Script id="qf-store-pixel" strategy="afterInteractive">
      {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixelId}');fbq('trackSingle','${pixelId}','PageView');`}
    </Script>
  );
}
