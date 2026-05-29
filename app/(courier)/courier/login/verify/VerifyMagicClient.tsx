"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function VerifyMagicClient({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/v1/courier/auth/verify-link", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token }),
        });
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body?.error?.message ?? "הקישור לא תקף");
          return;
        }
        router.push("/courier/home");
        router.refresh();
      } catch {
        if (!cancelled) setError("בעיית רשת");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, router]);

  if (error) {
    return (
      <div className="text-center space-y-3 max-w-sm">
        <p className="text-rose-400 font-medium">{error}</p>
        <a
          href="/courier/login"
          className="inline-block px-4 py-2 rounded-xl bg-emerald-500 text-[#062017] font-bold"
        >
          חזרה להתחברות
        </a>
      </div>
    );
  }
  return <p className="text-white/70">מאמת קישור...</p>;
}
