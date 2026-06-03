"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { canAccessDashboard, roleHome } from "@/lib/auth/merchant-access";

/**
 * Client-side defense-in-depth: if the current role can't open the path it
 * landed on (e.g. a kitchen user typing /dashboard/menu directly), bounce
 * it to that role's home. The most sensitive surfaces (billing, settings,
 * team) also have server-side guards; this catches everything else without
 * a per-section layout. Renders nothing.
 */
export function RoleRouteGuard({ role }: { role?: string }) {
  const pathname = usePathname() || "";
  const router = useRouter();

  useEffect(() => {
    if (!role) return;
    if (!canAccessDashboard(role, pathname)) {
      const home = roleHome(role);
      if (pathname !== home) router.replace(home);
    }
  }, [role, pathname, router]);

  return null;
}
