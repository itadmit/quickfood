/**
 * Design tokens - ported verbatim from prototypes:
 * - /Users/tadmitinteractive/Downloads/pizza/prototypes/app.jsx  (mobile)
 * - /Users/tadmitinteractive/Downloads/pizza/prototypes/dashboard.jsx (dashboard + 7 themes)
 */

export const MOBILE_TOKENS = {
  green: "#0e7a3c",
  greenDeep: "#0a5d2d",
  greenSoft: "#e7f5ec",
  greenLine: "#cfe8d8",
  mint: "#bef0cf",
  bg: "#f7f6f2",
  card: "#ffffff",
  ink: "#11231a",
  ink2: "#3a4a40",
  mute: "#7c8a82",
  line: "#ecede8",
  warm: "#f0e3c8",
  tomato: "#c2421f",
  yolk: "#e8a93b",
} as const;

export const DASHBOARD_TOKENS = {
  green: "#0e7a3c",
  greenDeep: "#0a5d2d",
  greenSoft: "#e7f5ec",
  greenLine: "#cfe8d8",
  mint: "#bef0cf",
  bg: "#f5f4ef",
  panel: "#ffffff",
  ink: "#11231a",
  ink2: "#3a4a40",
  mute: "#7c8a82",
  line: "#e8e9e3",
  lineSoft: "#f0f0eb",
  warm: "#f6e9c8",
  tomato: "#c2421f",
  tomatoSoft: "#fde2dc",
  yolk: "#e8a93b",
  yolkSoft: "#fff1d6",
  blue: "#2666c4",
  blueSoft: "#e1ebf7",
} as const;

export type ThemeId =
  | "fresh"
  | "basil"
  | "forest"
  | "olive"
  | "tomato"
  | "charcoal"
  | "cobalt"
  | "sunflower";

export interface Theme {
  id: ThemeId;
  name: string;
  primary: string;
  deep: string;
  soft: string;
  line: string;
  /** Foreground color to use on top of `primary` / `deep` backgrounds.
   *  Yellow themes need black text; everything else gets white. */
  onPrimary: "#000" | "#fff";
}

export const THEMES: Record<ThemeId, Theme> = {
  fresh: {
    id: "fresh",
    name: "ירוק טרי",
    primary: "#0e7a3c",
    deep: "#0a5d2d",
    soft: "#e7f5ec",
    line: "#cfe8d8",
    onPrimary: "#fff",
  },
  basil: {
    id: "basil",
    name: "בזיליקום",
    primary: "#3f7a2a",
    deep: "#2c5a1d",
    soft: "#eef5e7",
    line: "#d3e3c4",
    onPrimary: "#fff",
  },
  forest: {
    id: "forest",
    name: "יער",
    primary: "#15543a",
    deep: "#0e3c29",
    soft: "#e3eee9",
    line: "#bdd6c9",
    onPrimary: "#fff",
  },
  olive: {
    id: "olive",
    name: "זית",
    primary: "#6b7a36",
    deep: "#4f5b25",
    soft: "#f1f3e0",
    line: "#d8dcb5",
    onPrimary: "#fff",
  },
  tomato: {
    id: "tomato",
    name: "עגבנייה",
    primary: "#c2421f",
    deep: "#8e2a10",
    soft: "#fde2dc",
    line: "#f4b8a8",
    onPrimary: "#fff",
  },
  charcoal: {
    id: "charcoal",
    name: "גחלים",
    primary: "#2a2926",
    deep: "#181715",
    soft: "#ececea",
    line: "#cfcec9",
    onPrimary: "#fff",
  },
  cobalt: {
    id: "cobalt",
    name: "כחול קובלט",
    primary: "#1a4dad",
    deep: "#12377d",
    soft: "#e3ebf8",
    line: "#bccfee",
    onPrimary: "#fff",
  },
  sunflower: {
    id: "sunflower",
    name: "חמניה",
    primary: "#f8cb1e",
    deep: "#d4ad19",
    soft: "#fff2c9",
    line: "#f0d97a",
    onPrimary: "#000",
  },
};

export const DEFAULT_THEME: ThemeId = "fresh";

/**
 * Build a `style` attribute / CSS string that sets the theme CSS variables.
 * Used by ThemeProvider to inject a tenant's theme into <html>.
 */
export function themeVars(id: ThemeId): Record<string, string> {
  const t = THEMES[id] ?? THEMES[DEFAULT_THEME];
  return {
    "--qf-primary": t.primary,
    "--qf-deep": t.deep,
    "--qf-soft": t.soft,
    "--qf-line": t.line,
    "--qf-on-primary": t.onPrimary,
    // The `qf-green-*` palette is the brand accent across the storefront
    // (success flashes, soft fills, the add-to-cart confirmation). Re-point
    // it at the tenant's theme so every brand-colored surface follows the
    // chosen template instead of staying forest-green.
    "--color-qf-green": t.primary,
    "--color-qf-green-deep": t.deep,
    "--color-qf-green-soft": t.soft,
    "--color-qf-green-line": t.line,
  };
}

export function themeCssString(id: ThemeId): string {
  const vars = themeVars(id);
  return Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
}
