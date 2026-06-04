"use client";

import { useState } from "react";
import { PosContextProvider } from "@/components/pos/PosContext";
import { PosCartProvider } from "@/components/pos/PosCartProvider";
import { PosTopBar } from "@/components/pos/PosTopBar";
import { PosShiftOpenModal } from "@/components/pos/PosShiftOpenModal";
import { PosShiftCloseSummary } from "@/components/pos/PosShiftCloseSummary";
import { GrowPaymentSdk } from "@/components/customer/GrowPaymentSdk";

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
        {/* h-screen (not min-h) so the whole POS lives in the viewport.
            The menu picker + ticket scroll inside their own panes,
            keeping the bottom action row glued to the screen edge. */}
        <div className="h-screen flex flex-col bg-qf-bg overflow-hidden">
          <PosTopBar onCloseShift={() => setClosing(true)} />
          <main className="flex-1 min-h-0 overflow-hidden">{children}</main>
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
        {/* Mount the Grow SDK once at the shell so it preloads while the
            cashier interacts with the register — by the time they tap
            'אשראי' the iframes are ready and renderGrowWallet() resolves
            immediately. Same pattern as CustomerCheckout. */}
        <GrowPaymentSdk
          testMode
          thankYouUrl="/pos"
          onWalletChange={(state) => {
            if (state === "close") {
              // Fire a synthetic event so the payment sheet (if open)
              // can react. Cleanest cross-component channel here.
              window.dispatchEvent(new CustomEvent("qf:pos:wallet-close"));
            }
          }}
        />
      </PosCartProvider>
    </PosContextProvider>
  );
}
