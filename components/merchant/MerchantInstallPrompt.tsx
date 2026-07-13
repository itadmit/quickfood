"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Chrome killed the automatic install popup years ago - the browser only
 * fires `beforeinstallprompt` and expects the SITE to surface an install
 * button that calls prompt(). Without this banner, installing means digging
 * through the ⋮ menu, which nobody finds. Browsers that never fire the
 * event (Mi Browser, iOS Safari, already-installed) render nothing.
 */
export function MerchantInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(
    () =>
      typeof window !== "undefined" &&
      localStorage.getItem("qf_merchant_install_dismissed") === "1",
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    function onPrompt(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setDeferred(null);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
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

  if (!deferred || dismissed) return null;

  return (
    <div className="mb-3 rounded-xl bg-(--qf-primary)/10 border border-(--qf-primary)/30 p-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">התקינו את QuickFood כאפליקציה</p>
        <p className="text-xs text-qf-mute">אייקון במסך הבית, פתיחה במסך מלא בלי דפדפן</p>
      </div>
      <button
        type="button"
        onClick={install}
        disabled={busy}
        className="px-3 py-1.5 rounded-lg bg-black text-[#F8CB1E] text-xs font-bold disabled:opacity-60 whitespace-nowrap"
      >
        {busy ? "פותח..." : "התקנה"}
      </button>
      <button type="button" onClick={dismiss} className="text-qf-mute hover:text-qf-ink text-xs">
        לא עכשיו
      </button>
    </div>
  );
}
