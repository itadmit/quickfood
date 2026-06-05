"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { IcoClose } from "@/components/shared/Icons";

interface Campaign {
  id: string;
  imageUrl: string;
  linkUrl: string | null;
  title: string;
}

interface Props {
  tenantSlug: string;
}

const AUTO_CLOSE_MS = 25_000;

function todayKey() {
  // YYYY-MM-DD in the user's local timezone - popup is per-day, no need for UTC precision
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function storageKey(tenantSlug: string, campaignId: string) {
  return `qf:campaign:${tenantSlug}:${campaignId}:${todayKey()}`;
}

export function CampaignPopup({ tenantSlug }: Props) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [visible, setVisible] = useState(false);

  // Fetch the active campaign once on mount, then decide whether to show.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/v1/restaurants/${tenantSlug}/campaigns/active?kind=popup`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const data = (await res.json()) as { campaign: Campaign | null };
        if (cancelled || !data.campaign) return;
        const seen = window.localStorage.getItem(storageKey(tenantSlug, data.campaign.id));
        if (seen) return;
        setCampaign(data.campaign);
        // Defer paint a tick so the fade-in transition runs.
        window.setTimeout(() => !cancelled && setVisible(true), 50);
      } catch {
        // Silent - popup is non-critical.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantSlug]);

  // Auto-close after AUTO_CLOSE_MS once visible.
  useEffect(() => {
    if (!visible || !campaign) return;
    const t = window.setTimeout(() => dismiss(), AUTO_CLOSE_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, campaign?.id]);

  function dismiss() {
    if (!campaign) return;
    try {
      window.localStorage.setItem(storageKey(tenantSlug, campaign.id), "1");
    } catch {
      // ignore quota/private mode
    }
    setVisible(false);
    // Remove from DOM after the fade-out transition.
    window.setTimeout(() => setCampaign(null), 200);
  }

  if (!campaign) return null;

  const inner = (
    <div className="relative bg-white rounded-3xl overflow-hidden shadow-2xl max-w-sm w-full">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          dismiss();
        }}
        aria-label="סגור"
        className="absolute top-2.5 inset-e-2.5 z-10 w-9 h-9 rounded-full bg-black/55 backdrop-blur grid place-items-center hover:bg-black/70 transition"
      >
        <IcoClose c="#fff" s={18} />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={campaign.imageUrl}
        alt={campaign.title}
        className="block w-full h-auto object-cover"
      />
    </div>
  );

  return (
    <div
      className={
        "fixed inset-0 z-60 grid place-items-center p-5 transition-opacity duration-200 " +
        (visible ? "opacity-100" : "opacity-0 pointer-events-none")
      }
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={dismiss}
      role="dialog"
      aria-modal="true"
      aria-label={campaign.title}
    >
      {campaign.linkUrl ? (
        <Link
          href={campaign.linkUrl}
          onClick={(e) => {
            e.stopPropagation();
            dismiss();
          }}
          className="block max-w-sm w-full"
        >
          {inner}
        </Link>
      ) : (
        <div onClick={(e) => e.stopPropagation()} className="max-w-sm w-full">
          {inner}
        </div>
      )}
    </div>
  );
}
