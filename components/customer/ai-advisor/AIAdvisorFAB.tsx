"use client";

import { useEffect, useState } from "react";
import { AIAdvisorModal } from "./AIAdvisorModal";

const OPEN_EVENT = "qf:open-ai-advisor";

export function AIAdvisorFAB({
  tenantSlug,
  suggestions,
}: {
  tenantSlug: string;
  suggestions?: string[];
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, handler);
    return () => window.removeEventListener(OPEN_EVENT, handler);
  }, []);

  if (!open) return null;
  return (
    <AIAdvisorModal
      tenantSlug={tenantSlug}
      suggestions={suggestions}
      onClose={() => setOpen(false)}
    />
  );
}
