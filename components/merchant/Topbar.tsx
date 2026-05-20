"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { IcoSearch, IcoBell, IcoChevDown, Dot, IcoClose } from "@/components/shared/Icons";
import { formatPrice, formatRelativeMinutes } from "@/lib/format";
import { cn } from "@/lib/cn";

interface Props {
  user: { id: string; name: string; email: string; role: string };
  branch: { id: string; status: "open" | "busy" | "closed" } | null;
}

type Status = "open" | "busy" | "closed";

const STATUS_OPTIONS: Array<{ value: Status; label: string; sub: string }> = [
  { value: "open", label: "פתוח", sub: "מקבל הזמנות חדשות" },
  { value: "busy", label: "עומס", sub: "מקבל אבל מציג ETA ארוך יותר" },
  { value: "closed", label: "סגור", sub: "לא מקבל הזמנות חדשות" },
];

const STATUS_COLOR: Record<Status, { bg: string; text: string; dot: string }> = {
  open: { bg: "bg-qf-green-soft border-qf-green-line", text: "text-qf-green-deep", dot: "bg-qf-green" },
  busy: { bg: "bg-qf-yolk-soft border-qf-yolk/40", text: "text-qf-ink", dot: "bg-qf-yolk" },
  closed: { bg: "bg-qf-tomato-soft border-qf-tomato/40", text: "text-qf-tomato", dot: "bg-qf-tomato" },
};

export function Topbar({ user, branch }: Props) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const [status, setStatus] = useState<Status>(branch?.status ?? "open");
  const [statusBusy, setStatusBusy] = useState(false);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [kpis, setKpis] = useState<Kpis | null>(null);

  // Keyboard shortcut for search
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "Escape") {
        setStatusOpen(false);
        setBellOpen(false);
        setMenuOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Load notifications + kpis on mount + every 30s
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const [nRes, kRes] = await Promise.all([
          fetch("/api/v1/merchant/notifications").then((r) => r.json()),
          fetch("/api/v1/merchant/kpis").then((r) => r.json()),
        ]);
        if (!alive) return;
        setNotifications(nRes.notifications ?? []);
        setUnread(nRes.unread_count ?? 0);
        setKpis(kRes);
      } catch {
        /* ignore */
      }
    }
    load();
    const id = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  async function logout() {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.push("/dashboard/login");
    router.refresh();
  }

  async function changeStatus(next: Status) {
    if (!branch || next === status) {
      setStatusOpen(false);
      return;
    }
    const prev = status;
    setStatus(next);
    setStatusOpen(false);
    setStatusBusy(true);
    try {
      const res = await fetch(`/api/v1/merchant/branches/${branch.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) setStatus(prev);
      else router.refresh();
    } catch {
      setStatus(prev);
    } finally {
      setStatusBusy(false);
    }
  }

  const statusUi = STATUS_COLOR[status];
  const currentStatusOpt = STATUS_OPTIONS.find((s) => s.value === status)!;

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-qf-line-dash">
      <div className="h-16 px-6 flex items-center gap-4">
        {/* Search */}
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-qf-line-dash text-qf-mute text-sm w-72 hover:bg-qf-line-soft transition"
        >
          <IcoSearch c="#7c8a82" s={16} />
          <span>חיפוש בכל המערכת</span>
          <span className="ms-auto text-[10px] text-qf-mute/60">⌘K</span>
        </button>

        {/* Live KPIs */}
        <div className="hidden lg:flex items-center gap-2 text-xs text-qf-ink2">
          <Chip>
            זמן הכנה:{" "}
            <span className="tnum font-medium">
              {kpis?.avg_prep_minutes != null ? `${kpis.avg_prep_minutes} דק׳` : "—"}
            </span>
          </Chip>
          <Chip>
            בתור: <span className="tnum font-medium">{kpis?.active_orders ?? "—"}</span>
          </Chip>
          <Chip>
            שליחים:{" "}
            <span className="tnum font-medium">
              {kpis ? `${kpis.couriers_available}/${kpis.couriers_total}` : "—"}
            </span>
          </Chip>
        </div>

        {/* Status dropdown */}
        <div className="ms-auto relative">
          <button
            type="button"
            onClick={() => setStatusOpen((v) => !v)}
            disabled={!branch || statusBusy}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition",
              statusUi.bg,
              statusUi.text,
              statusBusy && "opacity-60",
            )}
          >
            <span className="relative flex h-2.5 w-2.5">
              {status === "open" && (
                <span className={cn("absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping", statusUi.dot)} />
              )}
              <span className={cn("relative inline-flex rounded-full h-2.5 w-2.5", statusUi.dot)} />
            </span>
            <span className="font-medium">{currentStatusOpt.label}</span>
            <IcoChevDown c="currentColor" s={14} />
          </button>
          {statusOpen && (
            <div className="absolute inset-e-0 mt-2 w-64 bg-white border border-qf-line-dash rounded-2xl shadow-lg p-1.5 text-sm z-50">
              {STATUS_OPTIONS.map((opt) => {
                const ui = STATUS_COLOR[opt.value];
                const active = opt.value === status;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => changeStatus(opt.value)}
                    className={cn(
                      "w-full text-start px-3 py-2 rounded-lg flex items-start gap-2.5",
                      active ? "bg-qf-line-soft" : "hover:bg-qf-line-soft",
                    )}
                  >
                    <span className={cn("mt-1 w-2.5 h-2.5 rounded-full shrink-0", ui.dot)} />
                    <div>
                      <div className={cn("font-medium", ui.text)}>{opt.label}</div>
                      <div className="text-xs text-qf-mute">{opt.sub}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Bell */}
        <div className="relative">
          <button
            type="button"
            aria-label="התראות"
            onClick={() => setBellOpen((v) => !v)}
            className="relative w-10 h-10 rounded-xl border border-qf-line-dash hover:bg-qf-line-soft grid place-items-center"
          >
            <IcoBell s={18} />
            {unread > 0 && (
              <span className="absolute -top-1.5 -inset-e-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-qf-tomato text-white text-[10px] font-bold grid place-items-center tnum ring-2 ring-white pointer-events-none">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </button>
          {bellOpen && (
            <div className="absolute inset-e-0 mt-2 w-80 bg-white border border-qf-line-dash rounded-2xl shadow-lg overflow-hidden z-50">
              <header className="px-4 py-2.5 flex items-center justify-between border-b border-qf-line-soft">
                <div className="font-semibold text-sm">התראות</div>
                <span className="text-xs text-qf-mute tnum">{unread} חדשות</span>
              </header>
              <div className="max-h-96 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-qf-mute">
                    אין התראות חדשות
                  </div>
                ) : (
                  notifications.map((n) => (
                    <Link
                      key={n.id}
                      href={n.href}
                      onClick={() => setBellOpen(false)}
                      className="block px-4 py-3 border-b border-qf-line-soft last:border-b-0 hover:bg-qf-line-soft/40"
                    >
                      <div className="flex items-start gap-2">
                        <Dot c={n.type === "webhook_failed" ? "#c2421f" : "#0e7a3c"} />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-sm">{n.title}</div>
                          <div className="text-xs text-qf-mute truncate">{n.body}</div>
                          <div className="text-[10px] text-qf-mute mt-0.5">
                            {formatRelativeMinutes(n.created_at)}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-xl border border-qf-line-dash hover:bg-qf-line-soft"
          >
            <div className="w-8 h-8 rounded-lg bg-(--qf-primary) text-white grid place-items-center text-xs font-bold">
              {user.name.slice(0, 2)}
            </div>
            <div className="text-xs leading-tight ps-0.5">
              <div className="font-medium">{user.name}</div>
              <div className="text-qf-mute">{roleLabel(user.role)}</div>
            </div>
            <IcoChevDown s={14} className="me-2" />
          </button>
          {menuOpen && (
            <div className="absolute inset-e-0 mt-2 w-56 bg-white border border-qf-line-dash rounded-2xl shadow-lg p-1.5 text-sm z-50">
              <div className="px-3 py-2 text-xs text-qf-mute" dir="ltr">
                {user.email}
              </div>
              <hr className="border-qf-line-soft" />
              <button
                type="button"
                onClick={() => router.push("/dashboard/settings/branding")}
                className="w-full text-start px-3 py-2 rounded-lg hover:bg-qf-line-soft"
              >
                הגדרות
              </button>
              <button
                type="button"
                onClick={logout}
                className="w-full text-start px-3 py-2 rounded-lg hover:bg-qf-tomato-soft text-qf-tomato"
              >
                התנתקות
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Search palette */}
      {searchOpen && (
        <SearchPalette onClose={() => setSearchOpen(false)} />
      )}
    </header>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-qf-line-soft border border-qf-line-dash">
      <Dot c="#0e7a3c" />
      {children}
    </div>
  );
}

function roleLabel(role: string): string {
  return (
    {
      owner: "בעלים",
      manager: "מנהל",
      kitchen: "מטבח",
      courier_dispatch: "שילוח",
      platform_admin: "פלטפורמה",
    } as Record<string, string>
  )[role] ?? role;
}

interface Notification {
  id: string;
  type: "order_new" | "webhook_failed";
  title: string;
  body: string;
  href: string;
  created_at: string;
  unread: boolean;
}

interface Kpis {
  avg_prep_minutes: number | null;
  active_orders: number;
  couriers_total: number;
  couriers_available: number;
}

// ─── Search palette ───────────────────────────────────────────

interface SearchResults {
  orders: Array<{ id: string; number: string; total: number; status: string; customer: string; created_at: string }>;
  items: Array<{ id: string; name: string; base_price: number; available: boolean; art_type: string | null }>;
  customers: Array<{ id: string; name: string; phone: string; orders_count: number }>;
}

function SearchPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResults>({ orders: [], items: [], customers: [] });
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) {
      // Deferred — outside synchronous body of effect
      const id = setTimeout(() => {
        setResults({ orders: [], items: [], customers: [] });
        setLoading(false);
      }, 0);
      return () => clearTimeout(id);
    }
    const tLoad = setTimeout(() => setLoading(true), 0);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/merchant/search?q=${encodeURIComponent(q)}`);
        if (res.ok) setResults(await res.json());
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(tLoad);
      clearTimeout(t);
    };
  }, [q]);

  const empty =
    results.orders.length === 0 &&
    results.items.length === 0 &&
    results.customers.length === 0;

  function go(href: string) {
    onClose();
    router.push(href);
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-start justify-center pt-24 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-qf-line-soft">
          <IcoSearch c="#7c8a82" s={18} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="חיפוש בכל המערכת: הזמנות, פריטים, לקוחות"
            className="flex-1 outline-none text-sm"
          />
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg hover:bg-qf-line-soft grid place-items-center text-qf-mute"
            aria-label="סגור"
          >
            <IcoClose s={14} />
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {q.trim().length < 2 ? (
            <div className="px-4 py-10 text-center text-sm text-qf-mute">
              הקלד לפחות 2 תווים כדי להתחיל לחפש
            </div>
          ) : loading ? (
            <div className="px-4 py-6 text-center text-xs text-qf-mute">מחפש...</div>
          ) : empty ? (
            <div className="px-4 py-10 text-center text-sm text-qf-mute">
              לא נמצאו תוצאות
            </div>
          ) : (
            <>
              {results.orders.length > 0 && (
                <Section title="הזמנות">
                  {results.orders.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => go(`/dashboard/orders`)}
                      className="w-full text-start px-4 py-2 hover:bg-qf-line-soft flex items-center justify-between gap-2"
                    >
                      <div className="font-mono text-sm">#{o.number}</div>
                      <div className="text-xs text-qf-mute flex-1 truncate">{o.customer}</div>
                      <div className="text-xs tnum">{formatPrice(o.total)}</div>
                    </button>
                  ))}
                </Section>
              )}
              {results.items.length > 0 && (
                <Section title="פריטי תפריט">
                  {results.items.map((it) => (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => go(`/dashboard/menu/${it.id}`)}
                      className="w-full text-start px-4 py-2 hover:bg-qf-line-soft flex items-center justify-between gap-2"
                    >
                      <div className="text-sm">{it.name}</div>
                      <div className="text-xs tnum">{formatPrice(it.base_price)}</div>
                    </button>
                  ))}
                </Section>
              )}
              {results.customers.length > 0 && (
                <Section title="לקוחות">
                  {results.customers.map((c) => (
                    <div
                      key={c.id}
                      className="px-4 py-2 flex items-center justify-between gap-2"
                    >
                      <div>
                        <div className="text-sm">{c.name || "אורח"}</div>
                        <div className="text-xs text-qf-mute" dir="ltr">{c.phone}</div>
                      </div>
                      <div className="text-xs text-qf-mute tnum">{c.orders_count} הזמנות</div>
                    </div>
                  ))}
                </Section>
              )}
            </>
          )}
        </div>
        <div className="px-4 py-2 text-[10px] text-qf-mute border-t border-qf-line-soft flex justify-between">
          <span>↵ פתח · ESC סגירה</span>
          <span dir="ltr">/api/v1/merchant/search</span>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="py-1.5">
      <div className="px-4 py-1 text-[10px] font-semibold text-qf-mute uppercase">
        {title}
      </div>
      {children}
    </div>
  );
}
