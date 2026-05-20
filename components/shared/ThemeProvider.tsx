import { themeVars, type ThemeId } from "@/lib/themes";

/**
 * Server component — injects the tenant's theme variables onto an element.
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
}: {
  themeId: ThemeId;
  children: React.ReactNode;
  className?: string;
}) {
  const vars = themeVars(themeId);
  return (
    <div data-theme={themeId} style={vars as React.CSSProperties} className={className}>
      {children}
    </div>
  );
}
