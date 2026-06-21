"use client";

import { useEffect, useState } from "react";
import { MenuFileImportModal } from "./menu/MenuFileImportModal";
import { takeMenuFile } from "@/lib/menu-import/handoff";

/**
 * Picks up the PDF/photo menu the merchant attached during signup (stashed in
 * IndexedDB) and auto-runs the importer once the store exists. Rendered only
 * when the dashboard URL carries ?menufile=1. The file read is one-shot, so a
 * refresh won't re-open it.
 */
export function MenuFileImportAutostart() {
  const [file, setFile] = useState<File | null>(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    let alive = true;
    void takeMenuFile().then((f) => {
      if (!alive) return;
      setFile(f);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!ready || !file || !open) return null;

  return (
    <MenuFileImportModal initialFile={file} autoStart onClose={() => setOpen(false)} />
  );
}
