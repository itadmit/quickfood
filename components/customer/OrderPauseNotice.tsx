"use client";

import { useLocale } from "@/components/customer/LocaleProvider";
import { IcoClock } from "@/components/shared/Icons";
import { formatTime } from "@/lib/format";
import { formatCountdown, usePauseCountdown } from "@/components/shared/usePauseCountdown";

export { formatCountdown, usePauseCountdown };

export function canPreorderWhenClosed(tenant: {
  scheduledOrdersEnabled?: boolean;
  preordersWhenClosed?: boolean;
}): boolean {
  return tenant.scheduledOrdersEnabled !== false && tenant.preordersWhenClosed === true;
}

export function OrderPauseNotice({
  pausedUntil,
  closed,
  preorder,
}: {
  pausedUntil: string | null | undefined;
  closed: boolean;
  preorder: boolean;
}) {
  const { t } = useLocale();
  const left = usePauseCountdown(pausedUntil);
  const paused = left !== null && left > 0;

  if (paused) {
    return (
      <section
        className="px-5 mt-4 lg:max-w-7xl lg:mx-auto lg:px-6"
        data-order-pause
        role="status"
        aria-live="polite"
      >
        <div className="bg-qf-tomato-soft border border-qf-tomato/30 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-white grid place-items-center shrink-0">
            <IcoClock s={20} c="#c2421f" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm text-qf-ink">{t("pause.title")}</div>
            <div className="text-xs text-qf-ink2 mt-0.5">
              {t("pause.resumesAt")} {formatTime(pausedUntil!)}
              {preorder && <> · {t("pause.preorderHint")}</>}
            </div>
          </div>
          <div className="text-center shrink-0">
            <div className="text-[11px] text-qf-mute">{t("pause.resumesIn")}</div>
            <div className="text-2xl font-bold tnum text-qf-tomato leading-tight" dir="ltr" suppressHydrationWarning>
              {formatCountdown(left)}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (closed && preorder) {
    return (
      <section className="px-5 mt-4 lg:max-w-7xl lg:mx-auto lg:px-6" data-preorder-notice>
        <div className="bg-white border border-qf-line rounded-2xl p-3.5 flex items-center gap-3">
          <IcoClock s={18} c="#7c8a82" />
          <div className="text-sm text-qf-ink2">{t("closed.preorderHint")}</div>
        </div>
      </section>
    );
  }

  return null;
}
