/**
 * Kiosk-specific loading fallback. The parent storefront loading.tsx
 * renders a multi-section skeleton tuned for the mobile/web menu —
 * categories rail, popular items, full menu list — which flashes on
 * top of the kiosk for the split second before the page boundary
 * resolves. That looks completely wrong on a 21" landscape kiosk.
 *
 * Override with a blank kiosk-coloured surface + a centred brand
 * spinner so the transition reads as "starting up the appliance"
 * instead of "loading the storefront." No content skeletons.
 */
export default function KioskLoading() {
  return (
    <div className="fixed inset-0 z-[200] bg-qf-bg grid place-items-center">
      <div className="flex flex-col items-center gap-5 text-center">
        <span
          className="qf-spinner text-(--qf-primary)"
          style={{ width: "4rem", height: "4rem", borderWidth: "5px" }}
          aria-hidden
        />
        <div className="text-xl font-bold text-qf-ink2 tracking-tight">
          טוען עמדה…
        </div>
      </div>
    </div>
  );
}
