"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/**
 * "Save to home screen" from settings. When Chrome hands us
 * beforeinstallprompt the button opens the native install dialog;
 * otherwise (event throttled, unsupported browser, iOS) a tap reveals
 * the manual add-to-home-screen steps for the current platform.
 */
export function InstallAppButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => isStandalone());
  const [showManual, setShowManual] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    function onPrompt(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setDeferred(null);
      setInstalled(true);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function onClick() {
    if (!deferred) {
      setShowManual(true);
      return;
    }
    setBusy(true);
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") setDeferred(null);
    } finally {
      setBusy(false);
    }
  }

  if (installed) {
    return (
      <p className="text-sm text-qf-mute">
        האפליקציה כבר מותקנת במכשיר הזה - אתם בתוכה עכשיו.
      </p>
    );
  }

  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isIos = /iPhone|iPad|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="px-5 py-2.5 rounded-xl bg-black text-[#F8CB1E] text-sm font-bold disabled:opacity-60"
      >
        {busy ? "פותח..." : "שמור במסך הבית"}
      </button>
      {showManual && !deferred && (
        <div className="rounded-xl bg-qf-line-soft/50 border border-qf-line-dash p-3 text-sm text-qf-ink2 leading-relaxed space-y-2">
          <p>
            {isIos
              ? "באייפון: פתחו את הדשבורד בספארי, לחצו על כפתור השיתוף ובחרו 'הוסף למסך הבית'."
              : isAndroid
                ? "באנדרואיד: פתחו את הדשבורד בכרום, לחצו על תפריט ⋮ למעלה ובחרו 'הוספה למסך הבית' (או 'התקנת אפליקציה')."
                : "במחשב: בכרום, לחצו על אייקון ההתקנה בסוף שורת הכתובת ובחרו 'התקנה'."}
          </p>
          {isAndroid && (
            <p>
              הדפדפן לא משתף פעולה? התקינו את{" "}
              <a href="/download" className="font-bold underline">
                אפליקציית האנדרואיד המלאה
              </a>{" "}
              - עובדת על כל מכשיר, כולל התראות על הזמנות.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
