"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { IcoLogout, IcoArrowLeft } from "@/components/shared/Icons";
import { SESSION_EXPIRED_EVENT, touchSession } from "@/lib/auth/client-session";

/**
 * Rolls the merchant's session in the background, and locks the screen when it
 * can't be rolled any more.
 *
 * Mounted once per shell (dashboard layout, POS). The keep-alive is cheap: at
 * most one request per 12h per device (see `touchSession`), triggered on mount
 * and whenever the tab comes back to the front - which is the common case for a
 * till that sits on the orders board for weeks at a time.
 *
 * The lock matters as much as the renewal. A store whose session died used to
 * see a board that looked perfectly normal, just permanently quiet; this says
 * out loud that nothing will arrive until they sign in again.
 */
const TOUCH_INTERVAL_MS = 6 * 60 * 60 * 1000;

export function SessionKeepAlive({
  loginHref = "/dashboard/login",
  renew = true,
}: {
  loginHref?: string;
  /**
   * Off while a platform admin is impersonating a store: the admin-return
   * cookie expires after 4h and takes the banner with it, so silently rolling
   * the impersonated session would strand the admin inside someone else's
   * dashboard with nothing on screen saying so.
   */
  renew?: boolean;
}) {
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!renew) return;
    void touchSession();
    const id = window.setInterval(() => void touchSession(), TOUCH_INTERVAL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void touchSession();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [renew]);

  useEffect(() => {
    const onExpired = () => setExpired(true);
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  if (!expired) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm grid place-items-center p-4">
      <div className="bg-white rounded-3xl shadow-xl max-w-md w-full p-6 text-center">
        <div className="mx-auto w-14 h-14 rounded-full bg-qf-yolk/30 grid place-items-center mb-4">
          <IcoLogout c="var(--qf-deep)" s={24} />
        </div>
        <h2 className="text-xl font-bold">ההתחברות למערכת פגה</h2>
        <p className="text-sm text-qf-ink2 mt-2 leading-relaxed">
          המסך הזה כבר לא מקבל הזמנות חדשות ולא ישמיע התראה. יש להתחבר מחדש כדי
          להמשיך לקבל הזמנות.
        </p>
        <Link
          href={loginHref}
          className="mt-5 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm font-medium"
        >
          התחברות מחדש
          <IcoArrowLeft c="currentColor" s={14} />
        </Link>
      </div>
    </div>
  );
}
