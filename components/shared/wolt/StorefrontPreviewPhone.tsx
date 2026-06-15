"use client";

import Image from "next/image";
import { THEMES, type ThemeId } from "@/lib/themes";
import styles from "./StorefrontPreviewPhone.module.css";

export interface StorefrontPreviewData {
  name: string;
  address: string | null;
  description: string | null;
  logo_url: string | null;
  cover_url: string | null;
  menu: {
    sampleItems: Array<{ name: string; image: string | null; price: number }>;
  } | null;
}

const PLACEHOLDER_ITEMS = [
  { name: "המבורגר קלאסי", image: null as string | null, price: 62 },
  { name: "צ׳יזבורגר אנטריקוט", image: null as string | null, price: 74 },
  { name: "פיצה מרגריטה", image: null as string | null, price: 56 },
  { name: "צ׳יפס בלגי + מיונז", image: null as string | null, price: 22 },
];

const PLACEHOLDER_CATEGORIES = [
  { name: "מנות עיקריות", icon: "utensils" as const },
  { name: "תוספות", icon: "leaf" as const },
  { name: "שתייה", icon: "glass" as const },
  { name: "קינוחים", icon: "cake" as const },
];

export function StorefrontPreviewPhone({
  preview,
  themeId,
  busy = false,
}: {
  preview: StorefrontPreviewData | null;
  themeId: ThemeId;
  busy?: boolean;
}) {
  const theme = THEMES[themeId];
  const showSkeleton = busy && !preview;

  const rawItems = preview?.menu?.sampleItems ?? [];
  const items = rawItems.length > 0 ? rawItems : PLACEHOLDER_ITEMS;

  const reorder = items[0];
  const popular = items.slice(0, 4);
  const cartCount = 3;
  const cartTotal =
    popular.slice(0, 2).reduce((s, it) => s + (it.price || 0), 0) || 74;

  const tenantName = preview?.name ?? "החנות שלך";
  const tenantTagline =
    preview?.description?.replace(/\s+/g, " ").trim().slice(0, 64) ||
    "מטבח שכונתי. תפריט חי. הזמנה ב-30 שניות.";
  const cityLabel = preview?.address?.split(",").pop()?.trim() || "גדרה";

  return (
    <div
      className={styles.phone}
      style={
        {
          "--accent": theme.primary,
          "--accent-deep": theme.deep,
          "--accent-soft": theme.soft,
          "--accent-on": theme.onPrimary,
        } as React.CSSProperties
      }
    >
      <div className={styles.phoneNotch} aria-hidden />
      <div className={styles.phoneScreen}>
        {/* ── Hero with cover image + dark overlay ──────────── */}
        <div className={styles.hero}>
          {preview?.cover_url ? (
            <Image
              src={preview.cover_url}
              alt=""
              fill
              sizes="380px"
              className={styles.heroImg}
              unoptimized
            />
          ) : (
            <div className={styles.heroEmpty} />
          )}
          <div className={styles.heroOverlay} aria-hidden />

          <div className={styles.heroContent}>
            <div className={styles.topRow}>
              <span className={styles.locationPill}>
                <PinIcon />
                {cityLabel}
              </span>
              <button
                type="button"
                className={styles.aiBtn}
                aria-hidden
                tabIndex={-1}
              >
                <SparkleIcon />
              </button>
            </div>

            <div className={styles.methodTabs}>
              <span className={`${styles.methodTab} ${styles.methodTabActive}`}>
                משלוח
              </span>
              <span className={styles.methodTab}>איסוף</span>
            </div>

            <div className={styles.searchPill}>
              <SearchIcon />
              <span>חיפוש בתפריט</span>
            </div>

            <div className={styles.tenantRow}>
              <div className={styles.tenantLogo}>
                {preview?.logo_url ? (
                  <Image
                    src={preview.logo_url}
                    alt=""
                    fill
                    sizes="56px"
                    className={styles.tenantLogoImg}
                    unoptimized
                  />
                ) : (
                  <Image
                    src="/quickfood-mark.png"
                    alt="QuickFood"
                    fill
                    sizes="56px"
                    className={styles.tenantLogoImg}
                  />
                )}
              </div>
              <div className={styles.tenantText}>
                <div className={styles.tenantName}>{tenantName}</div>
                <div className={styles.tenantTagline}>{tenantTagline}</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Info pill straddling hero seam ────────────────── */}
        <div className={styles.infoPillWrap}>
          <div className={styles.infoPill}>
            <span className={styles.infoOpen}>
              <span className={styles.openDot} />
              פתוח
            </span>
            <span className={styles.infoSep}>·</span>
            <span className={styles.infoItem}>
              <ClockIcon />
              25-35 דק&apos;
            </span>
            <span className={styles.infoSep}>·</span>
            <span className={styles.infoItem}>
              <BikeIcon />
              ₪14
            </span>
          </div>
        </div>

        {/* ── Body sections ─────────────────────────────────── */}
        <div className={styles.body}>
          {/* Previous orders */}
          <div className={styles.bodySection}>
            <div className={styles.sectionHead}>
              <h3 className={styles.sectionTitle}>הזמנות קודמות</h3>
              <span className={styles.sectionLink}>
                כל ההזמנות
                <ArrowLeftIcon />
              </span>
            </div>
            {showSkeleton ? (
              <div className={styles.reorderSkeleton} />
            ) : (
              <div className={styles.reorderCard}>
                <div className={styles.reorderImg}>
                  {reorder?.image ? (
                    <Image
                      src={reorder.image}
                      alt=""
                      fill
                      sizes="56px"
                      className={styles.reorderImgFill}
                      unoptimized
                    />
                  ) : (
                    <div className={styles.reorderImgFallback}>
                      <HelpMark />
                    </div>
                  )}
                </div>
                <div className={styles.reorderBody}>
                  <div className={styles.reorderName}>
                    {reorder?.name ?? "המבורגר + צ׳יפס"} +2
                  </div>
                  <div className={styles.reorderMeta}>
                    <ClockIcon />
                    <span>לפני 22 שע&apos;</span>
                    <span className={styles.reorderDot}>·</span>
                    <span>₪{reorder?.price || 88}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.reorderBtn}
                  aria-hidden
                  tabIndex={-1}
                >
                  <RefreshIcon />
                  הזמן שוב
                </button>
              </div>
            )}
          </div>

          {/* Categories */}
          <div className={styles.bodySection}>
            <h3 className={styles.sectionTitle}>קטגוריות</h3>
            <div className={styles.catRail}>
              {PLACEHOLDER_CATEGORIES.map((c) => (
                <div key={c.name} className={styles.catCard}>
                  <div className={styles.catCircle}>
                    <CategoryIcon name={c.icon} />
                  </div>
                  <div className={styles.catName}>{c.name}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Popular */}
          <div className={styles.bodySection}>
            <div className={styles.sectionHead}>
              <h3 className={styles.sectionTitle}>פופולריים</h3>
              <span className={styles.sectionLink}>
                לכל התפריט
                <ArrowLeftIcon />
              </span>
            </div>
            <div className={styles.popRail}>
              {showSkeleton
                ? [0, 1].map((i) => (
                    <div key={i} className={styles.popSkeleton} />
                  ))
                : popular.slice(0, 2).map((it, i) => (
                    <div key={i} className={styles.popCard}>
                      <div className={styles.popImg}>
                        {it.image ? (
                          <Image
                            src={it.image}
                            alt=""
                            fill
                            sizes="160px"
                            className={styles.popImgFill}
                            unoptimized
                          />
                        ) : (
                          <div className={styles.popImgFallback}>
                            <HelpMark size={42} />
                          </div>
                        )}
                      </div>
                      <div className={styles.popBody}>
                        <div className={styles.popName}>{it.name}</div>
                        {it.price > 0 && (
                          <div className={styles.popPrice}>₪{it.price}</div>
                        )}
                      </div>
                    </div>
                  ))}
            </div>
          </div>
        </div>

        {/* ── Bottom shell: cart bar + tab bar ──────────────── */}
        <div className={styles.bottomShell}>
          <div className={styles.cartBar}>
            <span className={styles.cartLabelGroup}>
              <span className={styles.cartCount}>{cartCount}</span>
              <span className={styles.cartLabel}>הצגת פריטים</span>
            </span>
            <span className={styles.cartTotalGroup}>
              <span className={styles.cartTotal}>₪{cartTotal}</span>
              <ChevronDownIcon />
            </span>
          </div>
          <div className={styles.tabBar}>
            <TabItem icon={<HomeIcon />} label="בית" active />
            <TabItem icon={<MenuIcon />} label="תפריט" />
            <TabItem
              icon={<CartIcon />}
              label="הסל שלי"
              badge={String(cartCount)}
            />
            <TabItem icon={<StarOutlineIcon />} label="ביקורות" />
            <TabItem icon={<UserCircleIcon />} label="אזור אישי" />
          </div>
        </div>
      </div>
    </div>
  );
}

function TabItem({
  icon,
  label,
  active,
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  badge?: string;
}) {
  return (
    <div className={`${styles.tabItem} ${active ? styles.tabItemActive : ""}`}>
      <div className={styles.tabIconWrap}>
        {icon}
        {badge && <span className={styles.tabBadge}>{badge}</span>}
      </div>
      <span className={styles.tabLabel}>{label}</span>
    </div>
  );
}

/* ─── Inline icons (kept local so the component is fully
   self-contained - no shared icon barrel needed). ──────────── */

function HelpMark({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M9.3 9a2.7 2.7 0 0 1 5.2.9c0 1.8-2.5 2.1-2.5 4" />
      <circle cx="12" cy="17.2" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
      <path d="M19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8z" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function BikeIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="5.5" cy="17.5" r="3.5" />
      <circle cx="18.5" cy="17.5" r="3.5" />
      <path d="M15 6h3l-3 11.5M5.5 17.5l4-9h5.5" />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
      <path d="M21 3v5h-5" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6M8 13h8M8 17h8M8 9h2" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="17" cy="20" r="1.5" />
      <path d="M3 4h2l2.7 11.4a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.5L21 7H6" />
    </svg>
  );
}

function StarOutlineIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3l2.9 5.9 6.5.95-4.7 4.6 1.1 6.45L12 17.8l-5.8 3.05 1.1-6.45-4.7-4.6 6.5-.95z" />
    </svg>
  );
}

function UserCircleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="10" r="3" />
      <path d="M6.5 19a6 6 0 0 1 11 0" />
    </svg>
  );
}

function CategoryIcon({ name }: { name: "utensils" | "leaf" | "glass" | "cake" }) {
  const stroke = "currentColor";
  if (name === "utensils")
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M7 2v8a3 3 0 0 1-3 3h0v9M10 2v9a3 3 0 0 1-3 3M7 13v9" />
        <path d="M17 22V7a5 5 0 0 1 0-5v20" />
      </svg>
    );
  if (name === "leaf")
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M11 20A7 7 0 0 1 4 13V6a2 2 0 0 1 2-2h7a7 7 0 0 1 7 7v0a7 7 0 0 1-7 7h-2z" />
        <path d="M4 20l8-8" />
      </svg>
    );
  if (name === "glass")
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M5 3h14l-2 9a5 5 0 0 1-5 4 5 5 0 0 1-5-4z" />
        <path d="M12 16v5M8 21h8" />
      </svg>
    );
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 13h16v7H4z" />
      <path d="M4 13l2-5h12l2 5M9 8V5a3 3 0 0 1 6 0v3" />
    </svg>
  );
}
