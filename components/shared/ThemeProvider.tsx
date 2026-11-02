import { themeVars, type ThemeId } from "@/lib/themes";

/**
 * Server component - injects the tenant's theme variables onto an element.
 * Use as a wrapper around tenant-scoped pages:
 *
 *   <ThemeProvider themeId={tenant.themeId}>
 *     ...
 *   </ThemeProvider>
 */
export function ThemeProvider({
  themeId,
  children,
  className,
  dir,
}: {
  themeId: ThemeId;
  children: React.ReactNode;
  className?: string;
  /** Text direction for this subtree. The storefront passes "ltr" for
   *  English/Russian; omitted inherits the document's "rtl". */
  dir?: "rtl" | "ltr";
}) {
  const vars = themeVars(themeId);
  return (
    <div data-theme={themeId} dir={dir} style={vars as React.CSSProperties} className={className}>
      {children}
    </div>
  );
}
