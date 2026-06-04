"use client";

import { useState } from "react";
import { usePos } from "@/components/pos/PosContext";
import { usePosCart } from "@/components/pos/PosCartProvider";
import { PosTicket } from "@/components/pos/PosTicket";
import { PosMenuPicker, type PosCategory, type PosItem } from "@/components/pos/PosMenuPicker";
import { PosItemConfigModal } from "@/components/pos/PosItemConfigModal";
import type { CartLine } from "@/components/customer/CartProvider";

interface ModalState {
  itemId: string;
  /** When set, the modal opens in edit mode and the existing line is
   *  rewritten (rather than appended) on confirm. */
  existingLine?: CartLine;
}

export function PosRegister({
  categories,
  items,
}: {
  categories: PosCategory[];
  items: PosItem[];
}) {
  const { shift, tenant } = usePos();
  const { hydrated, add, updateLine } = usePosCart();
  const [modal, setModal] = useState<ModalState | null>(null);

  // The forced shift-open modal handles the no-shift state at the shell
  // level; here we just guard against rendering an interactive register
  // before localStorage settles to avoid a one-frame flash of "empty cart".
  if (!shift || !hydrated) {
    return <div className="h-full grid place-items-center text-qf-mute">טוען קופה...</div>;
  }

  return (
    <div className="h-full flex min-h-0">
      <section className="flex-1 min-w-0 min-h-0 overflow-y-auto bg-qf-bg/40">
        <PosMenuPicker
          categories={categories}
          items={items}
          onConfigureItem={(itemId) => setModal({ itemId })}
        />
      </section>
      <aside className="w-[420px] lg:w-[460px] xl:w-[520px] shrink-0 border-s-2 border-black bg-white flex flex-col h-full min-h-0">
        <PosTicket onEditLine={(line) => setModal({ itemId: line.itemId, existingLine: line })} />
      </aside>

      {modal && (
        <PosItemConfigModal
          tenantSlug={tenant.slug}
          itemId={modal.itemId}
          existingLine={modal.existingLine}
          onClose={() => setModal(null)}
          onConfirm={(result) => {
            if (modal.existingLine) {
              updateLine(modal.existingLine.lineId, result.line);
            } else {
              add(result.line);
            }
            setModal(null);
          }}
        />
      )}
    </div>
  );
}
