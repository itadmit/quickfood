"use client";

import { useRouter } from "next/navigation";
import { Modal } from "@/components/shared/Modal";
import { WoltImportClient } from "./settings/advanced/WoltImportClient";

export function WoltImportModal({
  initialUrl,
  initialAck,
  autoStart,
}: {
  initialUrl: string;
  initialAck: boolean;
  autoStart: boolean;
}) {
  const router = useRouter();

  return (
    <Modal
      open
      onClose={() => router.push("/dashboard")}
      size="3xl"
      ariaLabel="ייבוא תפריט מ-Wolt"
      closeOnBackdrop={false}
    >
      <div className="p-6 space-y-2">
        <div>
          <h2 className="text-xl font-bold">ייבוא תפריט מ-Wolt</h2>
          <p className="text-sm text-qf-mute mt-0.5">
            מייבאים את הקטגוריות, הפריטים, התמונות והתוספות אוטומטית.
          </p>
        </div>
        <WoltImportClient
          lastImport={null}
          initialUrl={initialUrl}
          initialAck={initialAck}
          autoStart={autoStart}
          redirectOnDone="/dashboard/menu"
        />
      </div>
    </Modal>
  );
}
