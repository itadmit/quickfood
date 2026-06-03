"use client";

import Image from "next/image";
import { cn } from "@/lib/cn";
import type { VenueInfoPreview } from "@/lib/wolt-import/types";

export type VenueField = "about" | "address" | "phone" | "hours" | "cover" | "logo";

export type VenueApplyFlags = Record<VenueField, boolean>;

export function defaultApplyFlags(info: VenueInfoPreview): VenueApplyFlags {
  const { wolt, current } = info;
  return {
    about: !!wolt.about && !current.about,
    address: !!wolt.address && !current.address,
    phone: !!wolt.phone && !current.phone,
    hours: wolt.hasHours && !current.hasHours,
    cover: !!wolt.coverImageUrl && !current.coverImage,
    logo: !!wolt.logoImageUrl && !current.logoUrl,
  };
}

const FIELD_LABELS: Record<VenueField, string> = {
  about: "תיאור העסק",
  address: "כתובת",
  phone: "טלפון",
  hours: "שעות פעילות",
  cover: "תמונת כריכה",
  logo: "לוגו",
};

export function venueFieldLabel(field: string): string {
  return FIELD_LABELS[field as VenueField] ?? field;
}

export function VenueInfoPicker({
  info,
  flags,
  onToggle,
  heading = "פרטי החנות שזוהו בוולט",
  helper = "סמנו מה לעדכן ב-QuickFood. שדה שמסומן ושכבר קיים אצלכם — יידרס בערך מוולט.",
}: {
  info: VenueInfoPreview;
  flags: VenueApplyFlags;
  onToggle: (k: VenueField) => void;
  heading?: string;
  helper?: string;
}) {
  const { wolt, current } = info;
  const rows: Array<{
    key: VenueField;
    label: string;
    available: boolean;
    woltDisplay: React.ReactNode;
    currentDisplay: React.ReactNode;
    overwrite: boolean;
  }> = [
    {
      key: "about",
      label: "תיאור העסק",
      available: !!wolt.about,
      overwrite: !!wolt.about && !!current.about,
      woltDisplay: wolt.about ? (
        <span className="line-clamp-3 leading-relaxed whitespace-pre-line">{wolt.about}</span>
      ) : (
        <em className="text-qf-mute">אין תיאור בוולט</em>
      ),
      currentDisplay: current.about ? (
        <span className="line-clamp-3 leading-relaxed whitespace-pre-line">{current.about}</span>
      ) : (
        <em className="text-qf-mute">ריק</em>
      ),
    },
    {
      key: "address",
      label: "כתובת",
      available: !!wolt.address,
      overwrite: !!wolt.address && !!current.address,
      woltDisplay: wolt.address ?? <em className="text-qf-mute">—</em>,
      currentDisplay: current.address ?? <em className="text-qf-mute">ריק</em>,
    },
    {
      key: "phone",
      label: "טלפון",
      available: !!wolt.phone,
      overwrite: !!wolt.phone && !!current.phone,
      woltDisplay: wolt.phone ? (
        <span dir="ltr" className="tnum">
          {wolt.phone}
        </span>
      ) : (
        <em className="text-qf-mute">—</em>
      ),
      currentDisplay: current.phone ? (
        <span dir="ltr" className="tnum">
          {current.phone}
        </span>
      ) : (
        <em className="text-qf-mute">ריק</em>
      ),
    },
    {
      key: "hours",
      label: "שעות פעילות",
      available: wolt.hasHours,
      overwrite: wolt.hasHours && current.hasHours,
      woltDisplay: wolt.hasHours ? (
        <ul className="text-xs space-y-0.5">
          {wolt.hours.map((h) => (
            <li key={h.day} className="flex items-baseline gap-2 tnum">
              <span className="text-qf-mute w-12">{h.label}</span>
              <span className={h.active ? "" : "text-qf-mute"}>{h.display}</span>
            </li>
          ))}
        </ul>
      ) : (
        <em className="text-qf-mute">אין שעות בוולט</em>
      ),
      currentDisplay: current.hasHours ? "מוגדרות" : <em className="text-qf-mute">ריק</em>,
    },
    {
      key: "cover",
      label: "תמונת כריכה",
      available: !!wolt.coverImageUrl,
      overwrite: !!wolt.coverImageUrl && !!current.coverImage,
      woltDisplay: wolt.coverImageUrl ? (
        <div className="relative w-32 h-16 rounded-lg overflow-hidden bg-qf-line-soft">
          <Image
            src={wolt.coverImageUrl}
            alt=""
            fill
            sizes="128px"
            className="object-cover"
            unoptimized
          />
        </div>
      ) : (
        <em className="text-qf-mute">—</em>
      ),
      currentDisplay: current.coverImage ? (
        <div className="relative w-32 h-16 rounded-lg overflow-hidden bg-qf-line-soft">
          <Image
            src={current.coverImage}
            alt=""
            fill
            sizes="128px"
            className="object-cover"
            unoptimized
          />
        </div>
      ) : (
        <em className="text-qf-mute">ריק</em>
      ),
    },
    {
      key: "logo",
      label: "לוגו",
      available: !!wolt.logoImageUrl,
      overwrite: !!wolt.logoImageUrl && !!current.logoUrl,
      woltDisplay: wolt.logoImageUrl ? (
        <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-qf-line-soft">
          <Image
            src={wolt.logoImageUrl}
            alt=""
            fill
            sizes="48px"
            className="object-contain"
            unoptimized
          />
        </div>
      ) : (
        <em className="text-qf-mute">—</em>
      ),
      currentDisplay: current.logoUrl ? (
        <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-qf-line-soft">
          <Image
            src={current.logoUrl}
            alt=""
            fill
            sizes="48px"
            className="object-contain"
            unoptimized
          />
        </div>
      ) : (
        <em className="text-qf-mute">ריק</em>
      ),
    },
  ];

  return (
    <div>
      {heading && <h3 className="text-sm font-semibold mb-1">{heading}</h3>}
      {helper && (
        <p className="text-xs text-qf-mute mb-3 leading-relaxed">{helper}</p>
      )}
      <div className="border border-qf-line-dash rounded-2xl overflow-hidden bg-white">
        {rows.map((r, idx) => (
          <label
            key={r.key}
            className={cn(
              "grid grid-cols-[auto_1fr_1fr] gap-3 px-3 py-3 items-start text-sm cursor-pointer transition",
              idx > 0 && "border-t border-qf-line-dash",
              !r.available && "opacity-50 cursor-not-allowed",
              r.available && flags[r.key] && "bg-qf-green-soft/40",
            )}
          >
            <input
              type="checkbox"
              disabled={!r.available}
              checked={!!flags[r.key]}
              onChange={() => onToggle(r.key)}
              className="mt-1 accent-(--qf-primary)"
            />
            <div>
              <div className="font-medium flex items-center gap-2 flex-wrap">
                {r.label}
                {r.overwrite && flags[r.key] && (
                  <span className="text-[10px] bg-qf-tomato/15 text-qf-tomato px-1.5 py-0.5 rounded-md">
                    יידרוס קיים
                  </span>
                )}
              </div>
              <div className="text-xs text-qf-mute mt-0.5">מוולט</div>
              <div className="text-sm text-qf-ink2 mt-1">{r.woltDisplay}</div>
            </div>
            <div>
              <div className="text-xs text-qf-mute">ב-QuickFood עכשיו</div>
              <div className="text-sm text-qf-ink2 mt-1">{r.currentDisplay}</div>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}
