export const FB_PIXEL_ID =
  process.env.NEXT_PUBLIC_FB_PIXEL_ID ?? "1698088694710365";

export const FB_GRAPH_VERSION = "v21.0";

const EXCLUDED_PREFIXES = ["/s/", "/admin", "/courier", "/pos", "/dev"];

const DASHBOARD_ALLOW = new Set([
  "/dashboard/login",
  "/dashboard/forgot-password",
  "/dashboard/reset-password",
]);

export function isMarketingPath(pathname: string): boolean {
  if (pathname === "/s") return false;
  if (EXCLUDED_PREFIXES.some((p) => pathname.startsWith(p))) return false;
  if (pathname.startsWith("/dashboard")) return DASHBOARD_ALLOW.has(pathname);
  return true;
}
