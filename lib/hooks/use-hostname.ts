"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

export function useHostname(): string {
  return useSyncExternalStore(
    subscribe,
    () => window.location.hostname,
    () => "",
  );
}
