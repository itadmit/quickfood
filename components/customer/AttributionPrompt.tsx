"use client";

import { useEffect, useState } from "react";

const SRC_KEY = "qf:src";
const ASKED_PREFIX = "qf:src-asked:";

interface SourceOption {
  key: string;
  label: string;
}

/**
 * Lightweight, NON-BLOCKING "how did you hear about us?" prompt. Shown on the
 * checkout screen for customers who did NOT arrive through a tracked QR link
 * (those are already attributed server-side). Skipping is always allowed - it
 * never gates the order. The answer is stored as a self-reported attribution.
 */
// Decide up-front (lazily, client-only) whether to skip: already answered on
// this device, or arrived via a tracked QR that already recorded the source.
function initialSkip(tenantSlug: string): { skip: boolean; campaignCode?: string } {
  if (typeof window === "undefined") return { skip: false };
  try {
    if (window.localStorage.getItem(ASKED_PREFIX + tenantSlug)) return { skip: true };
    const url = new URL(window.location.href);
    const src = url.searchParams.get("src") ?? window.sessionStorage.getItem(SRC_KEY) ?? "";
    if (src.startsWith("qr_")) return { skip: true, campaignCode: src.slice(3) };
  } catch {
    /* ignore */
  }
  return { skip: false };
}

export function AttributionPrompt({ tenantSlug }: { tenantSlug: string }) {
  const [options, setOptions] = useState<SourceOption[]>([]);
  const [chosen, setChosen] = useState<string>("");
  const [init] = useState(() => initialSkip(tenantSlug));
  const [done, setDone] = useState(init.skip);
  const campaignCode = init.campaignCode;

  useEffect(() => {
    if (init.skip) return;
    fetch(`/api/v1/customer/attribution?slug=${encodeURIComponent(tenantSlug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.sources?.length) setOptions(d.sources);
      })
      .catch(() => {});
  }, [tenantSlug, init.skip]);

  if (done || options.length === 0) return null;

  function submit(sourceKey: string) {
    setDone(true);
    try {
      window.localStorage.setItem(ASKED_PREFIX + tenantSlug, "1");
      // Stashed so the order POST can attach it to the customer created at
      // checkout (guests aren't logged in when they answer).
      window.sessionStorage.setItem("qf:src-choice", sourceKey);
    } catch {
      /* ignore */
    }
    // Best-effort - failures must not affect checkout.
    fetch("/api/v1/customer/attribution", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: tenantSlug,
        source: sourceKey,
        firstTouchType: "checkout",
        campaignCode,
      }),
    }).catch(() => {});
  }

  function skip() {
    setDone(true);
    try {
      window.localStorage.setItem(ASKED_PREFIX + tenantSlug, "1");
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="rounded-2xl border border-qf-line bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="text-base font-semibold text-qf-ink">איך הגעת אלינו?</div>
        <button
          type="button"
          onClick={skip}
          className="text-xs text-qf-ink2 underline underline-offset-2"
        >
          דלג
        </button>
      </div>
      <p className="mt-1 text-xs text-qf-ink2">תשובה קצרה שעוזרת לנו להשתפר. לא חובה.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => {
              setChosen(o.key);
              submit(o.key);
            }}
            className={`rounded-full border px-3 py-1.5 text-sm transition ${
              chosen === o.key
                ? "border-(--qf-primary) bg-(--qf-primary) text-white"
                : "border-qf-line bg-qf-bg text-qf-ink hover:border-(--qf-primary)"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
