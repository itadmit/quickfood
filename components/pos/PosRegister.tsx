"use client";

import { usePos } from "@/components/pos/PosContext";
import { usePosCart } from "@/components/pos/PosCartProvider";
import { PosTicket } from "@/components/pos/PosTicket";
import { PosMenuPicker, type PosCategory, type PosItem } from "@/components/pos/PosMenuPicker";

export function PosRegister({
  categories,
  items,
}: {
  categories: PosCategory[];
  items: PosItem[];
}) {
  const { shift } = usePos();
  const { hydrated } = usePosCart();

  // The forced shift-open modal handles the no-shift state at the shell
  // level; here we just guard against rendering an interactive register
  // before localStorage settles to avoid a one-frame flash of "empty cart".
  if (!shift || !hydrated) {
    return <div className="h-full grid place-items-center text-qf-mute">טוען קופה...</div>;
  }

  return (
    <div className="h-full flex min-h-0">
      <section className="flex-1 min-w-0 min-h-0 overflow-y-auto bg-qf-bg/40">
        <PosMenuPicker categories={categories} items={items} />
      </section>
      <aside className="w-[420px] lg:w-[460px] xl:w-[520px] shrink-0 border-s-2 border-black bg-white flex flex-col h-full min-h-0">
        <PosTicket />
      </aside>
    </div>
  );
}
