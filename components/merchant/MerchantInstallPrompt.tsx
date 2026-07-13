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
 * Chrome killed the automatic install popup years ago - the browser only
 * fires `beforeinstallprompt` and expects the SITE to surface an install
 * button that calls prompt(). And on many phones the event never fires at
 * all (already installed once, Chrome throttling after a past dismissal,
 * Mi Browser, iOS) - so after a short grace period on mobile we fall back
 * to a banner with manual add-to-home-screen instructions. Running in
 * standalone display-mode means we're already installed: render nothing.
 */
export function MerchantInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [fallback, setFallback] = useState<"android" | "ios" | null>(null);
  const [dismissed, setDismissed] = useState(
    () =>
      typeof window !== "undefined" &&
      localStorage.getItem("qf_merchant_install_dismissed") === "1",
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;

    function onPrompt(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setFallback(null);
    }
    function onInstalled() {
      setDeferred(null);
      setFallback(null);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    const ua = navigator.userAgent;
    const platform = /iPhone|iPad|iPod/.test(ua)
      ? ("ios" as const)
      : /Android/.test(ua)
        ? ("android" as const)
        : null;
    const timer = platform
      ? window.setTimeout(() => setFallback((f) => f ?? platform), 3500)
      : undefined;

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  async function install() {
    if (!deferred) return;
    setBusy(true);
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") setDeferred(null);
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    localStorage.setItem("qf_merchant_install_dismissed", "1");
    setDismissed(true);
  }

  if (dismissed || (!deferred && !fallback)) return null;

  return (
    <div className="fixed bottom-4 inset-x-3 z-50 mx-auto w-auto max-w-md lg:bottom-6">
      <div className="rounded-2xl bg-white border-2 border-black shadow-xl p-3.5 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm">התקינו את QuickFood כאפליקציה</p>
          <p className="text-xs text-qf-mute">
            {deferred ? (
              "אייקון במסך הבית, פתיחה במסך מלא בלי דפדפן"
            ) : fallback === "ios" ? (
              "בספארי: לחצו על כפתור השיתוף ובחרו 'הוסף למסך הבית'"
            ) : (
              <>
                בכרום: תפריט ⋮ ← &apos;הוספה למסך הבית&apos;, או{" "}
                <a href="/download" className="font-bold underline text-qf-ink">
                  הורידו את האפליקציה
                </a>
              </>
            )}
          </p>
        </div>
        {deferred && (
          <button
            type="button"
            onClick={install}
            disabled={busy}
            className="px-3.5 py-2 rounded-xl bg-black text-[#F8CB1E] text-xs font-bold disabled:opacity-60 whitespace-nowrap"
          >
            {busy ? "פותח..." : "התקנה"}
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          className="text-qf-mute hover:text-qf-ink text-xs whitespace-nowrap"
        >
          {deferred ? "לא עכשיו" : "הבנתי"}
        </button>
      </div>
    </div>
  );
}
