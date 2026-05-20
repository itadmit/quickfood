/**
 * Icons — ported verbatim from prototypes/app.jsx (mobile) and prototypes/dashboard.jsx.
 * All icons are inline SVG that accept color (`c`) and size (`s`) props.
 */

type IconProps = {
  c?: string;
  s?: number;
  className?: string;
};

// ─── Mobile icons (T) ────────────────────────────────────────────

export const IcoSearch = ({ c = "#11231a", s = 20, className }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={className}>
    <circle cx="11" cy="11" r="7" stroke={c} strokeWidth="1.6" />
    <path d="M20 20l-3.5-3.5" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

export const IcoPin = ({ c = "#11231a", s = 18, className }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M12 21s7-6.2 7-12a7 7 0 10-14 0c0 5.8 7 12 7 12z" stroke={c} strokeWidth="1.6" />
    <circle cx="12" cy="9" r="2.5" stroke={c} strokeWidth="1.6" />
  </svg>
);

export const IcoChev = ({ c = "#11231a", s = 16, className }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M9 6l6 6-6 6" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IcoChevDown = ({ c = "#11231a", s = 14, className }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M6 9l6 6 6-6" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IcoCart = ({ c = "#fff", s = 22, className }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M4 5h2.5l2.5 11h9l2-7H7.5" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="10" cy="19.5" r="1.4" fill={c} />
    <circle cx="17" cy="19.5" r="1.4" fill={c} />
  </svg>
);

export const IcoHeart = ({ c = "#11231a", s = 20, fill = "none", className }: IconProps & { fill?: string }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill={fill} className={className}>
    <path d="M12 20s-7-4.4-7-10.2A4.3 4.3 0 0112 6a4.3 4.3 0 017 3.8c0 5.8-7 10.2-7 10.2z" stroke={c} strokeWidth="1.6" />
  </svg>
);

export const IcoStar = ({ c = "#11231a", s = 14, fill = "none", className }: IconProps & { fill?: string }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill={fill} className={className}>
    <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z" stroke={c} strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
);

export const IcoClock = ({ c = "#11231a", s = 14, className }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={className}>
    <circle cx="12" cy="12" r="8.5" stroke={c} strokeWidth="1.5" />
    <path d="M12 7.5V12l3 2" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const IcoBike = ({ c = "#11231a", s = 16, className }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={className}>
    <circle cx="5.5" cy="17" r="3" stroke={c} strokeWidth="1.5" />
    <circle cx="18.5" cy="17" r="3" stroke={c} strokeWidth="1.5" />
    <path d="M5.5 17l4-7h6l3 7M14 5h2l1 3" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IcoPlus = ({ c = "#fff", s = 18, className }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M12 5v14M5 12h14" stroke={c} strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

export const IcoMinus = ({ c = "#11231a", s = 18, className }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M5 12h14" stroke={c} strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

export const IcoFilter = ({ c = "#11231a", s = 18, className }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M4 6h16M7 12h10M10 18h4" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export const IcoHome = ({ c = "#11231a", s = 22, className }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1v-9z" stroke={c} strokeWidth="1.7" strokeLinejoin="round" />
  </svg>
);

export const IcoBag = ({ c = "#11231a", s = 22, className }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M5 7h14l-1 13H6L5 7zM9 7V5a3 3 0 016 0v2" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IcoUser = ({ c = "#11231a", s = 22, className }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={className}>
    <circle cx="12" cy="8" r="4" stroke={c} strokeWidth="1.7" />
    <path d="M4 21c1.5-4.5 5-6 8-6s6.5 1.5 8 6" stroke={c} strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

export const IcoReceipt = ({ c = "#11231a", s = 22, className }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" stroke={c} strokeWidth="1.7" strokeLinejoin="round" />
    <path d="M9 8h6M9 12h6M9 16h4" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const IcoFlame = ({ c = "#c2421f", s = 16, className }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill={c} className={className}>
    <path d="M12 2c2 4 6 5 6 11a6 6 0 11-12 0c0-3 2-4 2-7 2 1 4 0 4-4z" />
  </svg>
);

export const IcoLeaf = ({ c = "#0e7a3c", s = 14, className }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill={c} className={className}>
    <path d="M20 4c-8 0-14 4-14 11 0 2 1 4 2 5 5-1 12-5 12-16zM6 20c1-3 3-6 7-8" />
  </svg>
);

export const IcoClose = ({ c = "#11231a", s = 20, className }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M6 6l12 12M18 6L6 18" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export const IcoCheck = ({ c = "#fff", s = 14, className }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M5 12l4 4 10-10" stroke={c} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ─── Dashboard icons (I) ────────────────────────────────────────

export const IcoBell = ({ c = "#11231a", s = 18, className }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={className}>
    <path
      d="M6 9a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6zM10 19a2 2 0 004 0"
      stroke={c}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const IcoOrders = ({ c = "#11231a", s = 20, className }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M5 4h14l-1 16H6L5 4z" stroke={c} strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M9 4V3a3 3 0 016 0v1M9 10h6M9 14h4" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

export const IcoMenu = ({ c = "#11231a", s = 20, className }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M5 5h14M5 10h14M5 15h9M5 20h6" stroke={c} strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

export const IcoChart = ({ c = "#11231a", s = 20, className }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M4 20V6M10 20v-8M16 20v-5M22 20H2" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export const IcoGear = ({ c = "#11231a", s = 20, className }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={className}>
    <circle cx="12" cy="12" r="3" stroke={c} strokeWidth="1.6" />
    <path
      d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3h0a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8v0a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"
      stroke={c}
      strokeWidth="1.5"
    />
  </svg>
);

export const IcoTrend = ({ c = "#0e7a3c", s = 14, className }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M3 17l6-6 4 4 8-8M21 7v6M21 7h-6" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IcoPrinter = ({ c = "#11231a", s = 18, className }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={className}>
    <path
      d="M7 9V3h10v6M6 18H4a1 1 0 01-1-1v-6a2 2 0 012-2h14a2 2 0 012 2v6a1 1 0 01-1 1h-2M7 14h10v7H7v-7z"
      stroke={c}
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>
);

export const IcoPhone = ({ c = "#11231a", s = 16, className }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={className}>
    <path
      d="M22 16.9V20a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1A19.5 19.5 0 015 13.3 19.8 19.8 0 011.9 4.7 2 2 0 013.9 2.5H7a2 2 0 012 1.7c.1.9.3 1.8.6 2.6a2 2 0 01-.5 2.1L7.8 10.2a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.5c.8.3 1.7.5 2.6.6a2 2 0 011.7 2z"
      stroke={c}
      strokeWidth="1.6"
    />
  </svg>
);

export const IcoPizza = ({ c = "#c2421f", s = 18, className }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M12 3l9 16H3l9-16z" stroke={c} strokeWidth="1.6" strokeLinejoin="round" />
    <circle cx="10" cy="14" r="1" fill={c} />
    <circle cx="14" cy="14" r="1" fill={c} />
    <circle cx="12" cy="11" r="1" fill={c} />
  </svg>
);

export const IcoEye = ({ c = "#11231a", s = 16, className }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={className}>
    <path
      d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7S2.5 12 2.5 12z"
      stroke={c}
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="12" r="2.8" stroke={c} strokeWidth="1.6" />
  </svg>
);

export const IcoEdit = ({ c = "#11231a", s = 16, className }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={className}>
    <path
      d="M4 20h4l10.5-10.5a2.121 2.121 0 00-3-3L5 17v3z"
      stroke={c}
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    <path d="M14 6l4 4" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

export const IcoTrash = ({ c = "#11231a", s = 16, className }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M4 7h16" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
    <path
      d="M9 7V5a1.5 1.5 0 011.5-1.5h3A1.5 1.5 0 0115 5v2"
      stroke={c}
      strokeWidth="1.6"
      strokeLinecap="round"
    />
    <path
      d="M6 7l1 12.5A1.5 1.5 0 008.5 21h7a1.5 1.5 0 001.5-1.5L18 7"
      stroke={c}
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    <path d="M10 11v6M14 11v6" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

export const Dot = ({ c }: { c: string }) => (
  <span style={{ width: 8, height: 8, borderRadius: 99, background: c, display: "inline-block" }} />
);

export const IcoCreditCard = ({ c = "#11231a", s = 20, className }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={className}>
    <rect x="3" y="6" width="18" height="13" rx="2.5" stroke={c} strokeWidth="1.6" />
    <path d="M3 10h18" stroke={c} strokeWidth="1.6" />
    <path d="M7 15h4" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

export const IcoCash = ({ c = "#11231a", s = 20, className }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={className}>
    <rect x="2.5" y="6" width="19" height="12" rx="2" stroke={c} strokeWidth="1.6" />
    <circle cx="12" cy="12" r="2.4" stroke={c} strokeWidth="1.6" />
    <circle cx="5.5" cy="12" r="0.9" fill={c} />
    <circle cx="18.5" cy="12" r="0.9" fill={c} />
  </svg>
);

export const IcoWarning = ({ c = "#c2421f", s = 18, className }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={className}>
    <path
      d="M10.3 3.5L2.5 17a2 2 0 001.7 3h15.6a2 2 0 001.7-3L13.7 3.5a2 2 0 00-3.4 0z"
      stroke={c}
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    <path d="M12 9v5" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
    <circle cx="12" cy="17" r="1" fill={c} />
  </svg>
);

/**
 * Simple flat-arrow icons for buttons / links.
 * In a Hebrew RTL UI, "forward / next" actions visually go LEFT, "back"
 * actions go RIGHT — match the direction of the action, not the reading order.
 */
export const IcoArrowLeft = ({ c = "currentColor", s = 16, className }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={className}>
    <path
      d="M5 12h14M10 7l-5 5 5 5"
      stroke={c}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const IcoArrowRight = ({ c = "currentColor", s = 16, className }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={className}>
    <path
      d="M5 12h14M14 7l5 5-5 5"
      stroke={c}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const IcoCopy = ({ c = "currentColor", s = 16, className }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={className}>
    <rect x="9" y="9" width="11" height="11" rx="2" stroke={c} strokeWidth="1.6" />
    <path
      d="M5 15V6a2 2 0 012-2h9"
      stroke={c}
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

/** WhatsApp glyph — solid green inside a chat-bubble outline. */
export const IcoWhatsApp = ({ s = 16, className }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={className}>
    <path
      d="M3 21l1.3-4A8 8 0 1112 20a8 8 0 01-3.7-.9L3 21z"
      fill="#25D366"
    />
    <path
      d="M9 8.5c.2-.5.5-.5.7-.5l.4.01c.2 0 .4 0 .6.4.2.5.7 1.7.8 1.8.1.1.1.3 0 .5l-.3.4-.3.3c-.1.1-.2.2-.1.4.1.2.6 1 1.2 1.6.8.7 1.5 1 1.7 1 .2.1.4.1.5-.1l.7-.8c.1-.2.3-.1.5 0l1.7.8c.2.1.4.2.4.3 0 .1 0 .8-.3 1.5-.3.7-1.5 1.4-2 1.5-.6.1-1.3.2-2.7-.4-2.3-1-3.8-3.4-3.9-3.5-.1-.2-.9-1.2-.9-2.3 0-1.1.6-1.6.8-1.9z"
      fill="#fff"
    />
  </svg>
);
