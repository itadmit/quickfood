"use client";

import { useState } from "react";
import { PosContextProvider } from "@/components/pos/PosContext";
import { PosCartProvider } from "@/components/pos/PosCartProvider";
import { PosTopBar } from "@/components/pos/PosTopBar";
import { PosShiftOpenModal } from "@/components/pos/PosShiftOpenModal";
import { PosShiftCloseSummary } from "@/components/pos/PosShiftCloseSummary";

export interface PosShellProps {
  cashier: { id: string; name: string; role: string };
  tenant: { id: string; slug: string; name: string; logoLetter: string };
  branch: { id: string; name: string };
  shift: { id: string; openedAt: string; openingFloat: number } | null;
  children: React.ReactNode;
}

export function PosShell({ cashier, tenant, branch, shift: initialShift, children }: PosShellProps) {
  const [shift, setShift] = useState(initialShift);
  // Forced "open shift" modal blocks the whole UI until the cashier types
  // the opening cash float. Owners/managers training pass through with
  // float=0 if they want to play.
  const needsShift = !shift;
  const [closing, setClosing] = useState(false);

  return (
    <PosContextProvider
      cashier={cashier}
      tenant={tenant}
      branch={branch}
      shift={shift}
      onShiftChange={setShift}
    >
      <PosCartProvider tenantSlug={tenant.slug}>
        <div className="min-h-screen flex flex-col bg-qf-bg">
          <PosTopBar onCloseShift={() => setClosing(true)} />
          <main className="flex-1 overflow-hidden">{children}</main>
        </div>
        {needsShift && <PosShiftOpenModal onOpened={setShift} />}
        {closing && shift && (
          <PosShiftCloseSummary
            shift={shift}
            onClose={() => setClosing(false)}
            onClosed={() => {
              setClosing(false);
              setShift(null);
            }}
          />
        )}
      </PosCartProvider>
    </PosContextProvider>
  );
}
