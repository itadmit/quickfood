export const FB_PIXEL_ID =
  process.env.NEXT_PUBLIC_FB_PIXEL_ID ?? "1698088694710365";

export const FB_GRAPH_VERSION = "v21.0";

const PLATFORM_HOST = "quickfood.co.il";

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

export function isPlatformHost(host: string): boolean {
  const h = host.toLowerCase().split(":")[0];
  if (!h) return false;
  if (h === PLATFORM_HOST || h.endsWith(`.${PLATFORM_HOST}`)) return true;
  if (h.endsWith(".vercel.app")) return true;
  if (h === "localhost" || h === "127.0.0.1") return true;
  return false;
}

export function isTrackablePage(pathname: string, host: string): boolean {
  return isPlatformHost(host) && isMarketingPath(pathname);
}
