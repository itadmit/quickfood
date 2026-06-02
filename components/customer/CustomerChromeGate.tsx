"use client";

import { usePathname } from "next/navigation";

/**
 * Hides storefront chrome (top nav, floating cart, AI FAB, promos,
 * merchant preview bar, review prompt) on every customer pay surface
 * so the screen stays focused on the wallet form. Covers both the
 * order-pay flow (`/s/<slug>/pay/...`) and the kiosk QR flow
 * (`/s/<slug>/pay-checkout/...`).
 */
export function CustomerChromeGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  if (/\/s\/[^/]+\/pay(-checkout)?(\/|$)/.test(pathname)) return null;
  return <>{children}</>;
}
