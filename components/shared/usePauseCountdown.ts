"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function usePauseCountdown(pausedUntil: string | null | undefined): number | null {
  const router = useRouter();
  const target = pausedUntil ? new Date(pausedUntil).getTime() : null;
  const [now, setNow] = useState(() => Date.now());
  const refreshedFor = useRef<number | null>(null);

  useEffect(() => {
    if (!target) return;
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= target && refreshedFor.current !== target) {
        refreshedFor.current = target;
        router.refresh();
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [target, router]);

  if (!target) return null;
  return Math.max(0, Math.ceil((target - now) / 1000));
}

export function formatCountdown(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
