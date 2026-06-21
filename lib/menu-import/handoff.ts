"use client";

// Carries a captured/selected menu file across the signup -> dashboard
// navigation. The Wolt path hands off via a URL query string, but a PDF/photo
// is binary and too large for sessionStorage, so we stash the Blob in IndexedDB
// during signup and pull it out (once) on the dashboard to auto-run the import.

const DB_NAME = "qf-onboarding";
const STORE = "menuFile";
const KEY = "pending";

type StashedFile = { blob: Blob; name: string; type: string };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function stashMenuFile(file: File): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const record: StashedFile = { blob: file, name: file.name, type: file.type };
      tx.objectStore(STORE).put(record, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

// Reads and removes the stashed file - a one-shot, so a dashboard refresh
// doesn't re-open the importer.
export async function takeMenuFile(): Promise<File | null> {
  if (typeof indexedDB === "undefined") return null;
  let db: IDBDatabase;
  try {
    db = await openDb();
  } catch {
    return null;
  }
  try {
    const rec = await new Promise<StashedFile | null>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const r = tx.objectStore(STORE).get(KEY);
      r.onsuccess = () => resolve((r.result as StashedFile | undefined) ?? null);
      r.onerror = () => reject(r.error);
    });
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    if (!rec?.blob) return null;
    return new File([rec.blob], rec.name || "menu", {
      type: rec.type || rec.blob.type || "application/octet-stream",
    });
  } catch {
    return null;
  } finally {
    db.close();
  }
}
