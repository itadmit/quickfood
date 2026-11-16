const KEY = "qf:dashboard-menu-view";

export interface MenuViewState {
  cat: string;
  search: string;
  itemId: string | null;
}

export function readMenuView(): MenuViewState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<MenuViewState>;
    return {
      cat: typeof v.cat === "string" ? v.cat : "all",
      search: typeof v.search === "string" ? v.search : "",
      itemId: typeof v.itemId === "string" ? v.itemId : null,
    };
  } catch {
    return null;
  }
}

export function writeMenuView(patch: Partial<MenuViewState>) {
  if (typeof window === "undefined") return;
  try {
    const prev = readMenuView() ?? { cat: "all", search: "", itemId: null };
    window.sessionStorage.setItem(KEY, JSON.stringify({ ...prev, ...patch }));
  } catch {}
}
