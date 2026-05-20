"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IcoSearch, IcoBell, IcoChevDown, Dot } from "@/components/shared/Icons";

interface Props {
  user: { id: string; name: string; email: string; role: string };
}

export function Topbar({ user }: Props) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  async function logout() {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.push("/dashboard/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-qf-line-dash">
      <div className="h-16 px-6 flex items-center gap-4">
        {/* Search */}
        <button
          type="button"
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-qf-line-dash text-qf-mute text-sm w-72 hover:bg-qf-line-soft transition"
        >
          <IcoSearch c="#7c8a82" s={16} />
          <span>חיפוש בכל המערכת</span>
          <span className="ms-auto text-[10px] text-qf-mute/60">⌘K</span>
        </button>

        {/* Live KPIs */}
        <div className="flex items-center gap-2 text-xs text-qf-ink2">
          <Chip>זמן הכנה: 12 דק&apos;</Chip>
          <Chip>בתור: 4</Chip>
          <Chip>שליחים: 2/3</Chip>
        </div>

        {/* Restaurant status */}
        <div className="ms-auto flex items-center gap-2 px-3 py-2 rounded-xl bg-qf-green-soft border border-qf-green-line text-sm">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-qf-green opacity-60 animate-ping" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-qf-green" />
          </span>
          <span className="font-medium text-qf-green-deep">פתוח</span>
          <IcoChevDown c="#0a5d2d" s={14} />
        </div>

        {/* Bell */}
        <button
          type="button"
          aria-label="התראות"
          className="relative w-10 h-10 rounded-xl border border-qf-line-dash hover:bg-qf-line-soft grid place-items-center"
        >
          <IcoBell s={18} />
          <span className="absolute top-1.5 inset-e-1.5 inline-block w-2 h-2 rounded-full bg-qf-tomato" />
        </button>

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
            <div className="absolute inset-e-0 mt-2 w-56 bg-white border border-qf-line-dash rounded-2xl shadow-lg p-1.5 text-sm">
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
    </header>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <div className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-qf-line-soft border border-qf-line-dash">
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
