"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PosContextProvider } from "@/components/pos/PosContext";
import { PosCartProvider } from "@/components/pos/PosCartProvider";
import { PosTopBar } from "@/components/pos/PosTopBar";
import { PosShiftOpenModal } from "@/components/pos/PosShiftOpenModal";
import { PosShiftCloseSummary } from "@/components/pos/PosShiftCloseSummary";
import { GrowPaymentSdk } from "@/components/customer/GrowPaymentSdk";
import { IcoCheck } from "@/components/shared/Icons";
import { usePosCart } from "@/components/pos/PosCartProvider";

export interface PosShellProps {
  cashier: { id: string; name: string; role: string };
  tenant: { id: string; slug: string; name: string; logoLetter: string };
  branch: { id: string; name: string };
  /** Tenant's Grow sandbox flag. The SDK must agree with the server's
   *  payment provider; passing the wrong value rejects the auth code
   *  with "הלינק שנשלח אינו תקין". Defaults to true (sandbox) only as a
   *  safety net for tenants without Grow configured. */
  growTestMode: boolean;
  shift: { id: string; openedAt: string; openingFloat: number } | null;
  children: React.ReactNode;
}

export function PosShell({ cashier, tenant, branch, growTestMode, shift: initialShift, children }: PosShellProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [shift, setShift] = useState(initialShift);
  // Forced "open shift" modal blocks the whole UI until the cashier types
  // the opening cash float. Owners/managers training pass through with
  // float=0 if they want to play.
  const needsShift = !shift;
  const [closing, setClosing] = useState(false);
  // Card payment success: Grow navigates the page to /pos?paid=1 after
  // window.location.href in onSuccess. Detect on mount, show a banner,
  // then drop the query so a refresh doesn't re-trigger it. The PosCart
  // localStorage was cleared by `clear()` before the navigation.
  const [paidBanner, setPaidBanner] = useState(false);
  useEffect(() => {
    if (searchParams?.get("paid") === "1") {
      setPaidBanner(true);
      // Replace before the timer so the success state lives in React only.
      router.replace("/pos");
      const t = window.setTimeout(() => setPaidBanner(false), 2800);
      return () => window.clearTimeout(t);
    }
  }, [searchParams, router]);

  return (
    <PosContextProvider
      cashier={cashier}
      tenant={tenant}
      branch={branch}
      shift={shift}
      onShiftChange={setShift}
    >
      <PosCartProvider tenantSlug={tenant.slug}>
        <PaidBannerSync paidBanner={paidBanner} />
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
          testMode={growTestMode}
          thankYouUrl="/pos?paid=1"
          onWalletChange={(state) => {
            if (state === "close") {
              // Fire a synthetic event so the payment sheet (if open)
              // can react. Cleanest cross-component channel here.
              window.dispatchEvent(new CustomEvent("qf:pos:wallet-close"));
            }
          }}
        />
        {paidBanner && (
          <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4 pointer-events-none">
            <div className="pointer-events-auto bg-white rounded-3xl border-2 border-black shadow-[0_6px_0_#000] p-8 text-center animate-qf-check-in">
              <div className="w-20 h-20 rounded-full bg-qf-green-soft border-4 border-qf-green-deep grid place-items-center mx-auto">
                <IcoCheck c="#0e7a3c" s={40} />
              </div>
              <h2 className="text-2xl font-black mt-4">תשלום אשראי התקבל</h2>
              <p className="text-sm text-qf-mute mt-2">ההזמנה הועברה למטבח</p>
            </div>
          </div>
        )}
      </PosCartProvider>
    </PosContextProvider>
  );
}

/**
 * Tiny child of PosCartProvider whose only job is to clear the cart the
 * first time we render with a "paid=1" banner — that's our success
 * landing after the Grow SDK navigation. Done as a child so we can call
 * usePosCart() (a hook inside the provider).
 */
function PaidBannerSync({ paidBanner }: { paidBanner: boolean }) {
  const { clear, hydrated } = usePosCart();
  useEffect(() => {
    if (paidBanner && hydrated) clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paidBanner, hydrated]);
  return null;
}
