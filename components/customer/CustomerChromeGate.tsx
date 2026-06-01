"use client";

import { usePathname } from "next/navigation";

/**
 * Hides storefront chrome (top nav, floating cart, AI FAB, promos,
 * merchant preview bar, review prompt) on the customer pay page so
 * the screen stays focused on the wallet form. Anything wrapped in
 * this gate renders nothing under `/s/<slug>/pay/...`.
 */
export function CustomerChromeGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  if (/\/s\/[^/]+\/pay(\/|$)/.test(pathname)) return null;
  return <>{children}</>;
}
