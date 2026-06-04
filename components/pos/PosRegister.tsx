"use client";

import { usePos } from "@/components/pos/PosContext";
import { usePosCart } from "@/components/pos/PosCartProvider";
import { PosTicket } from "@/components/pos/PosTicket";
import { PosMenuPicker } from "@/components/pos/PosMenuPicker";

export function PosRegister() {
  const { shift } = usePos();
  const { hydrated } = usePosCart();

  // The forced shift-open modal handles the no-shift state at the shell
  // level; here we just guard against rendering an interactive register
  // before localStorage settles to avoid a one-frame flash of "empty cart".
  if (!shift || !hydrated) {
    return <div className="h-full grid place-items-center text-qf-mute">טוען קופה...</div>;
  }

  return (
    <div className="h-full flex">
      <section className="flex-1 min-w-0 overflow-y-auto">
        <PosMenuPicker />
      </section>
      <aside className="w-[420px] shrink-0 border-s-2 border-black bg-white flex flex-col">
        <PosTicket />
      </aside>
    </div>
  );
}
