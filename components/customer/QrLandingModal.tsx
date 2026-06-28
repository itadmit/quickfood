"use client";

import { useEffect, useState } from "react";
import { Modal, ModalBody } from "@/components/shared/Modal";

interface LandingCopy {
  headline: string;
  body: string;
  cta: string;
}

// Reads the ?src=qr_{code} marker captured on landing and, for `landing`-type
// QR campaigns, shows the campaign content as a ONE-TIME modal over the menu -
// no extra page, no navigation. Non-landing campaigns return null content.
function readCode(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const fromUrl = new URL(window.location.href).searchParams.get("src");
    const src = fromUrl ?? window.sessionStorage.getItem("qf:src") ?? "";
    if (src.startsWith("qr_")) return src.slice(3);
  } catch {
    /* ignore */
  }
  return null;
}

export function QrLandingModal({ tenantSlug }: { tenantSlug: string }) {
  const [copy, setCopy] = useState<LandingCopy | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const code = readCode();
    if (!code) return;
    const seenKey = `qf:qr-landing-seen:${code}`;
    try {
      if (window.sessionStorage.getItem(seenKey)) return;
    } catch {
      /* ignore */
    }
    fetch(
      `/api/v1/customer/qr-landing?slug=${encodeURIComponent(tenantSlug)}&code=${encodeURIComponent(code)}`,
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.landing) {
          setCopy(d.landing);
          setOpen(true);
          try {
            window.sessionStorage.setItem(seenKey, "1");
          } catch {
            /* ignore */
          }
        }
      })
      .catch(() => {});
  }, [tenantSlug]);

  if (!copy) return null;

  return (
    <Modal open={open} onClose={() => setOpen(false)} size="sm" ariaLabel={copy.headline}>
      <ModalBody>
        <div className="text-center py-3">
          <h2 className="text-2xl font-black text-qf-ink leading-tight">{copy.headline}</h2>
          <p className="mt-3 text-base text-qf-ink2 leading-relaxed">{copy.body}</p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-6 w-full inline-flex items-center justify-center rounded-2xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white px-5 h-14 text-base font-bold transition active:scale-[0.99]"
          >
            {copy.cta}
          </button>
        </div>
      </ModalBody>
    </Modal>
  );
}
