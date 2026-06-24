import {
  IcoOrders,
  IcoMenu,
  IcoHome,
  IcoStar,
  IcoBike,
  IcoGear,
  IcoMegaphone,
  IcoBell,
  IcoCreditCard,
  IcoSparkle,
  IcoChart,
  IcoBag,
  IcoCrown,
} from "@/components/shared/Icons";

// Shared nav config for the V2 dashboard skin - same list rendered by
// SidebarV2 on desktop and MobileMenuV2 on mobile.
export type NavChild = {
  href: string;
  label: string;
  exact?: boolean;
  match?: string;
  badge?: string;
};

export type NavItem = {
  href: string;
  label: string;
  Icon: typeof IcoHome;
  exact?: boolean;
  match?: string;
  badge?: string;
  children?: NavChild[];
};

export type NavSection = { title: string; items: NavItem[] };

export const NAV: NavSection[] = [
  {
    title: "תפעול",
    items: [
      { href: "/dashboard", label: "דשבורד", Icon: IcoHome, exact: true },
      // exact:true on the live kanban so it doesn't ALSO light up when
      // the merchant is browsing /dashboard/orders/history - the
      // startsWith default matched both and made the active state look
      // doubled. History below has no subroutes so the default is fine.
      { href: "/dashboard/orders", label: "הזמנות", Icon: IcoOrders, exact: true },
      { href: "/dashboard/orders/history", label: "היסטוריית הזמנות", Icon: IcoOrders },
      { href: "/dashboard/kitchen", label: "מסך מטבח", Icon: IcoOrders, badge: "חדש!" },
      { href: "/pos", label: "קופה", Icon: IcoBag, badge: "חדש!" },
      {
        href: "/dashboard/menu",
        label: "תפריט",
        Icon: IcoMenu,
        match: "/dashboard/menu",
        children: [
          { href: "/dashboard/menu", label: "מוצרים", match: "/dashboard/menu" },
          { href: "/dashboard/categories", label: "קטגוריות", match: "/dashboard/categories" },
          { href: "/dashboard/menu/modifiers", label: "קטלוג תוספות", match: "/dashboard/menu/modifiers" },
          { href: "/dashboard/menu/notices", label: "הודעות", match: "/dashboard/menu/notices" },
        ],
      },
      { href: "/dashboard/analytics", label: "אנליטיקס", Icon: IcoChart },
      { href: "/dashboard/couriers", label: "שליחים", Icon: IcoBike },
    ],
  },
  {
    title: "שיווק",
    items: [
      { href: "/dashboard/campaigns", label: "קמפיינים", Icon: IcoMegaphone },
      { href: "/dashboard/loyalty", label: "מועדון לקוחות", Icon: IcoCrown, badge: "חדש!" },
      { href: "/dashboard/sales/bundles", label: "מבצעי חבילות", Icon: IcoCreditCard, badge: "חדש!" },
      { href: "/dashboard/coupons", label: "קופונים", Icon: IcoCreditCard },
      { href: "/dashboard/reviews", label: "ביקורות", Icon: IcoStar },
      { href: "/dashboard/messaging", label: "דיוור והתראות", Icon: IcoBell, badge: "חדש!" },
      { href: "/dashboard/ai-advisor", label: "יועץ AI", Icon: IcoSparkle, badge: "חדש!" },
    ],
  },
  {
    title: "מערכת",
    items: [
      { href: "/dashboard/billing", label: "חיוב ומנוי", Icon: IcoCreditCard },
      {
        href: "/dashboard/settings/branding",
        label: "הגדרות",
        Icon: IcoGear,
        match: "/dashboard/settings",
      },
    ],
  },
];
