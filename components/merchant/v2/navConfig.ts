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
} from "@/components/shared/Icons";

// Shared nav config for the V2 dashboard skin — same list rendered by
// SidebarV2 on desktop and MobileMenuV2 on mobile.
export type NavItem = {
  href: string;
  label: string;
  Icon: typeof IcoHome;
  exact?: boolean;
  match?: string;
  badge?: string;
};

export type NavSection = { title: string; items: NavItem[] };

export const NAV: NavSection[] = [
  {
    title: "תפעול",
    items: [
      { href: "/dashboard", label: "דשבורד", Icon: IcoHome, exact: true },
      { href: "/dashboard/orders", label: "הזמנות", Icon: IcoOrders },
      { href: "/dashboard/menu", label: "תפריט", Icon: IcoMenu },
      { href: "/dashboard/analytics", label: "אנליטיקס", Icon: IcoChart, badge: "חדש!" },
      { href: "/dashboard/couriers", label: "שליחים", Icon: IcoBike },
    ],
  },
  {
    title: "שיווק",
    items: [
      { href: "/dashboard/campaigns", label: "קמפיינים", Icon: IcoMegaphone },
      { href: "/dashboard/coupons", label: "קופונים", Icon: IcoCreditCard },
      { href: "/dashboard/reviews", label: "ביקורות", Icon: IcoStar },
      { href: "/dashboard/sms", label: "SMS", Icon: IcoBell },
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
