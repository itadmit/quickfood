"use client";

import { createContext, useContext } from "react";

export interface PosShiftState {
  id: string;
  openedAt: string;
  openingFloat: number;
}

export interface PosContextValue {
  cashier: { id: string; name: string; role: string };
  tenant: { id: string; slug: string; name: string; logoLetter: string };
  branch: { id: string; name: string };
  shift: PosShiftState | null;
  setShift: (next: PosShiftState | null) => void;
}

const PosContext = createContext<PosContextValue | null>(null);

export function PosContextProvider({
  cashier,
  tenant,
  branch,
  shift,
  onShiftChange,
  children,
}: {
  cashier: PosContextValue["cashier"];
  tenant: PosContextValue["tenant"];
  branch: PosContextValue["branch"];
  shift: PosShiftState | null;
  onShiftChange: (next: PosShiftState | null) => void;
  children: React.ReactNode;
}) {
  return (
    <PosContext.Provider
      value={{ cashier, tenant, branch, shift, setShift: onShiftChange }}
    >
      {children}
    </PosContext.Provider>
  );
}

export function usePos(): PosContextValue {
  const ctx = useContext(PosContext);
  if (!ctx) throw new Error("usePos must be called inside <PosContextProvider>");
  return ctx;
}
