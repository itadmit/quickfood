"use client";

import { usePosCart } from "@/components/pos/PosCartProvider";
import { formatPrice } from "@/lib/format";
import { IcoClose, IcoUser } from "@/components/shared/Icons";

interface Props {
  onClose: () => void;
  /** Called after a parked ticket is restored — POS shell typically closes
   *  the modal and the cart panel pops the recalled ticket in place. */
  onRestored?: () => void;
}

/**
 * Recall list for parked tickets. The cashier sets a ticket aside via
 * the "החזק" button in the cart footer; that ticket shows up here with
 * its label, parked-at time, item count, and total. Tap to bring it
 * back; tap the X to discard.
 *
 * If the working cart isn't empty we warn before restoring (parking
 * the current ticket would have been a separate action — restoring now
 * dumps it).
 */
export function PosParkedTicketsModal({ onClose, onRestored }: Props) {
  const { parked, restoreParked, discardParked, lines } = usePosCart();
  const workingCartHasContent = lines.length > 0;

  function handleRestore(id: string, label: string) {
    if (workingCartHasContent) {
      const ok = confirm(
        `הכרטיסייה הנוכחית תאבד כדי לטעון את "${label}". להמשיך?`,
      );
      if (!ok) return;
    }
    restoreParked(id);
    onRestored?.();
    onClose();
  }

  function handleDiscard(id: string, label: string) {
    const ok = confirm(`למחוק את הכרטיסייה "${label}"?`);
    if (!ok) return;
    discardParked(id);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white rounded-3xl border-2 border-black shadow-[0_6px_0_#000] p-5 max-h-[80vh] flex flex-col animate-qf-check-in"
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-black">כרטיסיות מוחזקות</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="סגור"
            className="w-9 h-9 rounded-lg grid place-items-center text-qf-mute hover:bg-qf-line-soft"
          >
            <IcoClose s={18} />
          </button>
        </div>

        {parked.length === 0 ? (
          <div className="text-center text-qf-mute text-sm py-8">
            אין כרטיסיות מוחזקות.
            <div className="mt-2 text-xs">
              לחיצה על "החזק" בכרטיסייה הנוכחית תשמור אותה כאן.
            </div>
          </div>
        ) : (
          <ul className="flex-1 overflow-y-auto space-y-2 -mx-1 px-1">
            {parked.map((p) => {
              const time = new Date(p.parkedAt).toLocaleTimeString("he-IL", {
                hour: "2-digit",
                minute: "2-digit",
              });
              const itemCount = p.lines.reduce((s, l) => s + l.quantity, 0);
              return (
                <li
                  key={p.id}
                  className="flex items-stretch gap-2 border-2 border-black rounded-2xl shadow-[0_2px_0_#000] overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => handleRestore(p.id, p.label)}
                    className="flex-1 px-3 py-3 text-start bg-white hover:bg-qf-line-soft transition"
                  >
                    <div className="font-bold text-sm flex items-center gap-2">
                      <span className="truncate">{p.label}</span>
                      <span className="text-[11px] text-qf-mute tnum">· {time}</span>
                    </div>
                    <div className="text-xs text-qf-mute mt-1 flex items-center gap-2">
                      {p.customer && (
                        <span className="inline-flex items-center gap-1">
                          <IcoUser s={11} c="currentColor" />
                          <span className="truncate max-w-[120px]">{p.customer.name}</span>
                          <span aria-hidden>·</span>
                        </span>
                      )}
                      <span className="tnum">{itemCount} פריטים</span>
                      <span aria-hidden>·</span>
                      <span className="tnum font-bold text-qf-ink">
                        {formatPrice(p.subtotal)}
                      </span>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDiscard(p.id, p.label)}
                    aria-label="מחק"
                    className="px-3 bg-qf-tomato-soft text-qf-tomato border-r-2 border-black grid place-items-center hover:bg-qf-tomato/20 transition"
                  >
                    <IcoClose s={16} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
