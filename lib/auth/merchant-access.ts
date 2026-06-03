/**
 * Role-based access policy for the merchant dashboard.
 *
 * Single source of truth used by both the nav (to hide sections a role
 * can't use) and the server/client route guards (to enforce it). Pure
 * functions — safe to import from server components and client components.
 *
 * Matrix (confirmed with the owner):
 *   owner            → everything
 *   manager          → everything except billing (team/advanced settings
 *                      keep their own owner-only page guards)
 *   kitchen          → orders + kitchen screen only
 *   courier_dispatch → orders + couriers only
 */

export type MerchantRole =
  | "owner"
  | "manager"
  | "kitchen"
  | "courier_dispatch"
  | "platform_admin"
  | "api"
  | string;

function normalize(pathname: string): string {
  // Drop query/hash; collapse trailing slash (except root).
  const p = (pathname.split("?")[0] || "").split("#")[0];
  return p.length > 1 && p.endsWith("/") ? p.slice(0, -1) : p;
}

/** Whether `role` may open a dashboard route. */
export function canAccessDashboard(role: string | undefined, pathname: string): boolean {
  if (!role) return false;
  if (role === "owner" || role === "platform_admin") return true;

  const p = normalize(pathname);
  const inOrders = p === "/dashboard/orders" || p.startsWith("/dashboard/orders/");
  const inKitchen = p === "/dashboard/kitchen" || p.startsWith("/dashboard/kitchen/");
  const inCouriers = p === "/dashboard/couriers" || p.startsWith("/dashboard/couriers/");

  if (role === "kitchen") return inOrders || inKitchen;
  if (role === "courier_dispatch") return inOrders || inCouriers;
  if (role === "manager") {
    return !(p === "/dashboard/billing" || p.startsWith("/dashboard/billing/"));
  }
  return false;
}

/** Where to send a role when it lands on (or is bounced from) a page it can't see. */
export function roleHome(role: string | undefined): string {
  if (role === "kitchen") return "/dashboard/kitchen";
  if (role === "courier_dispatch") return "/dashboard/orders";
  return "/dashboard";
}
