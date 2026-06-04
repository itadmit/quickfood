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
 *   cashier          → POS only (no /dashboard access)
 */

export type MerchantRole =
  | "owner"
  | "manager"
  | "kitchen"
  | "courier_dispatch"
  | "platform_admin"
  | "cashier"
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

  const p = normalize(pathname);
  const inPos = p === "/pos" || p.startsWith("/pos/");
  if (role === "cashier") return inPos;
  if (inPos) {
    // Owners and managers may train/debug on the POS. Other roles can't.
    return role === "owner" || role === "manager" || role === "platform_admin";
  }

  if (role === "owner" || role === "platform_admin") return true;

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
  if (role === "cashier") return "/pos";
  if (role === "kitchen") return "/dashboard/kitchen";
  if (role === "courier_dispatch") return "/dashboard/orders";
  return "/dashboard";
}
