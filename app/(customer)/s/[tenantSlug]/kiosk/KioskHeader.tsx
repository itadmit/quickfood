"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function KioskHeader({
  logoUrl,
  tenantName,
  children,
}: {
  logoUrl: string | null;
  tenantName: string;
  children?: ReactNode;
}) {
  return (
    <header className="flex items-center justify-between gap-4 px-7 py-4 bg-white border-b border-qf-line-soft shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={tenantName}
            className="w-11 h-11 rounded-xl object-contain shrink-0 bg-white"
          />
        ) : (
          <div className="w-11 h-11 rounded-xl bg-(--qf-primary) text-white grid place-items-center font-black text-lg shrink-0">
            {tenantName.slice(0, 1)}
          </div>
        )}
        <h1 className="text-xl font-bold text-qf-ink truncate tracking-tight">
          {tenantName}
        </h1>
      </div>
      {children ? (
        <div className="flex items-center gap-2 shrink-0">{children}</div>
      ) : null}
    </header>
  );
}

export function KioskHeaderButton({
  onClick,
  children,
  variant = "ghost",
  ariaLabel,
  startIcon,
}: {
  onClick: () => void;
  children: ReactNode;
  variant?: "ghost" | "soft";
  ariaLabel?: string;
  startIcon?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center gap-2 px-5 h-12 rounded-xl text-base font-semibold transition",
        variant === "ghost"
          ? "border-2 border-qf-line-soft text-qf-ink2 hover:bg-qf-line-soft"
          : "bg-(--qf-soft) text-(--qf-deep) hover:bg-(--qf-primary)/15",
      )}
    >
      {startIcon}
      {children}
    </button>
  );
}
