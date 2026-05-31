"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IcoCheck, IcoCopy, IcoClose, IcoTrash } from "@/components/shared/Icons";
import { cn } from "@/lib/cn";

type Status = "none" | "pending" | "active" | "error";

interface DnsRecord {
  type: "A" | "CNAME" | "TXT";
  name: string;
  value: string;
}

interface DomainState {
  domain: string | null;
  status: Status;
  added_at: string | null;
  verified_at: string | null;
  last_error: string | null;
  dns_records?: DnsRecord[];
  misconfigured?: boolean | null;
  configured_by?: string | null;
}

export function DomainForm({
  slug,
  initial,
}: {
  slug: string;
  initial: Omit<DomainState, "dns_records" | "misconfigured" | "configured_by">;
}) {
  const router = useRouter();
  const [state, setState] = useState<DomainState>({ ...initial });
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState<"add" | "verify" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // Surfaces the running auto-poll to the user — both as a soft "still
  // checking" affordance and so they don't double-click verify while a
  // background poll is in flight.
  const [polling, setPolling] = useState(false);

  // Fetch the latest server state on mount so dns_records + misconfigured
  // (which the SSR `select` didn't include) come down on the first render.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/v1/merchant/domain");
      if (cancelled || !res.ok) return;
      const data = (await res.json()) as DomainState;
      setState(data);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-poll the verify endpoint every 8 seconds while pending. DNS +
  // SSL provisioning is asynchronous — we don't want the merchant to
  // sit there clicking "Verify" every 30 seconds. The poll stops as
  // soon as the row flips to "active", or if the merchant kicks off
  // a manual action (add/remove). Caps at 60 attempts (~8 minutes) so
  // a permanently misconfigured DNS doesn't burn the Vercel rate limit.
  useEffect(() => {
    if (state.status !== "pending") {
      setPolling(false);
      return;
    }
    if (busy) return;
    let cancelled = false;
    let attempts = 0;
    setPolling(true);

    const tick = async () => {
      if (cancelled) return;
      attempts++;
      try {
        const res = await fetch("/api/v1/merchant/domain/verify", { method: "POST" });
        if (cancelled) return;
        if (res.ok) {
          const data = (await res.json()) as { ok?: boolean };
          const fresh = await fetch("/api/v1/merchant/domain");
          if (cancelled) return;
          if (fresh.ok) setState((await fresh.json()) as DomainState);
          if (data.ok) {
            setToast("הדומיין פעיל — החנות שלך זמינה בכתובת החדשה");
            setTimeout(() => setToast(null), 4000);
            router.refresh();
            return;
          }
        }
      } catch {
        // network blips happen; keep polling.
      }
      if (attempts < 60 && !cancelled) {
        setTimeout(tick, 8000);
      } else {
        setPolling(false);
      }
    };

    const initial = setTimeout(tick, 5000);
    return () => {
      cancelled = true;
      clearTimeout(initial);
      setPolling(false);
    };
  }, [state.status, busy, router]);

  async function addDomain() {
    const trimmed = input.trim();
    if (!trimmed) return;
    setBusy("add");
    setError(null);
    try {
      const res = await fetch("/api/v1/merchant/domain", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error?.message ?? "הוספה נכשלה");
        return;
      }
      setState(data as DomainState);
      setInput("");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function verify() {
    setBusy("verify");
    setError(null);
    try {
      const res = await fetch("/api/v1/merchant/domain/verify", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error?.message ?? "האימות נכשל");
        return;
      }
      // Re-pull the full state to refresh DNS records + status.
      const fresh = await fetch("/api/v1/merchant/domain");
      if (fresh.ok) setState((await fresh.json()) as DomainState);
      if (data.ok) {
        setToast("הדומיין מחובר ופעיל");
        setTimeout(() => setToast(null), 2500);
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function removeCurrent() {
    if (!confirm("להסיר את הדומיין? החנות תחזור להיות זמינה רק בכתובת ברירת המחדל.")) {
      return;
    }
    setBusy("remove");
    setError(null);
    try {
      const res = await fetch("/api/v1/merchant/domain", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error?.message ?? "ההסרה נכשלה");
        return;
      }
      setState({
        domain: null,
        status: "none",
        added_at: null,
        verified_at: null,
        last_error: null,
        dns_records: [],
      });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const hasDomain = state.domain && state.status !== "none";

  return (
    <div className="space-y-5">
      {toast && (
        <div className="rounded-xl border-2 border-black bg-[#d1f5d6] px-4 py-2 text-sm font-semibold text-[#0a5e2a] flex items-center gap-2">
          <IcoCheck c="#0a5e2a" s={16} /> {toast}
        </div>
      )}

      {!hasDomain && (
        <AddDomainCard
          input={input}
          setInput={setInput}
          add={addDomain}
          busy={busy === "add"}
          error={error}
          fallbackUrl={`https://quickfood.co.il/s/${slug}`}
        />
      )}

      {hasDomain && (
        <ActiveDomainCard
          state={state}
          verify={verify}
          remove={removeCurrent}
          busyVerify={busy === "verify"}
          busyRemove={busy === "remove"}
          polling={polling}
          error={error}
        />
      )}
    </div>
  );
}

function AddDomainCard({
  input,
  setInput,
  add,
  busy,
  error,
  fallbackUrl,
}: {
  input: string;
  setInput: (s: string) => void;
  add: () => void;
  busy: boolean;
  error: string | null;
  fallbackUrl: string;
}) {
  return (
    <section className="rounded-3xl border-2 border-black bg-white shadow-[0_3px_0_#000] p-5 lg:p-7">
      <h2 className="text-xl font-black mb-1">חיבור דומיין</h2>
      <p className="text-sm text-black/70 mb-5 leading-relaxed">
        רוצה שהחנות שלך תהיה זמינה בכתובת משלך (למשל{" "}
        <span className="font-mono font-bold">order.mypizza.co.il</span>) במקום{" "}
        <span className="font-mono">{fallbackUrl}</span>? הקלד את הדומיין כאן ונדריך אותך
        בהגדרת ה-DNS. ה-SSL מונפק אוטומטית.
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && input.trim()) add();
          }}
          placeholder="order.mypizza.co.il"
          dir="ltr"
          className="flex-1 rounded-xl border-2 border-black px-4 py-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#F8CB1E]"
        />
        <button
          onClick={add}
          disabled={busy || !input.trim()}
          className={cn(
            "rounded-xl border-2 border-black px-6 py-3 text-sm font-black shadow-[0_3px_0_#000] transition",
            busy || !input.trim()
              ? "bg-black/10 text-black/40 cursor-not-allowed"
              : "bg-black text-[#F8CB1E] hover:translate-y-[1px] hover:shadow-[0_2px_0_#000]",
          )}
        >
          {busy ? "מוסיף..." : "הוסף דומיין"}
        </button>
      </div>

      {error && (
        <div className="mt-3 rounded-xl border-2 border-[#c2421f] bg-[#fde8e3] px-4 py-2 text-sm font-semibold text-[#c2421f] flex items-start gap-2">
          <IcoClose c="#c2421f" s={16} />
          <span>{error}</span>
        </div>
      )}
    </section>
  );
}

function ActiveDomainCard({
  state,
  verify,
  remove,
  busyVerify,
  busyRemove,
  polling,
  error,
}: {
  state: DomainState;
  verify: () => void;
  remove: () => void;
  busyVerify: boolean;
  busyRemove: boolean;
  polling: boolean;
  error: string | null;
}) {
  const isActive = state.status === "active";
  const records = state.dns_records ?? [];

  return (
    <section className="rounded-3xl border-2 border-black bg-white shadow-[0_3px_0_#000] overflow-hidden">
      <header className="p-5 lg:p-7 border-b-2 border-black flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-black/60 font-bold mb-1">
            הדומיין שלך
          </div>
          <div className="text-2xl font-black font-mono" dir="ltr">
            {state.domain}
          </div>
        </div>
        <StatusPill status={state.status} polling={polling && !isActive} />
      </header>

      {!isActive && (
        <div className="p-5 lg:p-7 border-b-2 border-black bg-[#fffbea]">
          <PropagationBanner polling={polling} />
          {records.length > 0 && (
            <>
              <h3 className="text-base font-black mb-2 mt-4">הגדר את ה-DNS אצל ספק הדומיין</h3>
              <p className="text-sm text-black/70 mb-4 leading-relaxed">
                הוסף את הרשומות הבאות בלוח הבקרה של ספק הדומיין שלך (GoDaddy / Cloudflare /
                Namecheap וכו׳). לאחר שהרשומות התפרסמו, ניתן ללחוץ "בדוק חיבור"
                — או פשוט לחכות, אנחנו בודקים אוטומטית כל כמה שניות.
              </p>
              <div className="space-y-2.5">
                {records.map((r, i) => (
                  <DnsRow key={i} record={r} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {state.last_error && (
        <div className="mx-5 lg:mx-7 mt-4 rounded-xl border-2 border-[#c2421f] bg-[#fde8e3] px-4 py-2 text-sm font-semibold text-[#c2421f] flex items-start gap-2">
          <IcoClose c="#c2421f" s={16} />
          <span>{state.last_error}</span>
        </div>
      )}

      {error && (
        <div className="mx-5 lg:mx-7 mt-4 rounded-xl border-2 border-[#c2421f] bg-[#fde8e3] px-4 py-2 text-sm font-semibold text-[#c2421f] flex items-start gap-2">
          <IcoClose c="#c2421f" s={16} />
          <span>{error}</span>
        </div>
      )}

      <div className="p-5 lg:p-7 flex flex-col sm:flex-row gap-3 sm:justify-between sm:items-center">
        <div className="flex gap-3 flex-wrap">
          {!isActive && (
            <button
              onClick={verify}
              disabled={busyVerify}
              className={cn(
                "rounded-xl border-2 border-black px-5 py-2.5 text-sm font-black shadow-[0_3px_0_#000] transition",
                busyVerify
                  ? "bg-black/10 text-black/40 cursor-not-allowed"
                  : "bg-[#F8CB1E] text-black hover:translate-y-[1px] hover:shadow-[0_2px_0_#000]",
              )}
            >
              {busyVerify ? "בודק..." : "בדוק חיבור"}
            </button>
          )}
          {isActive && state.domain && (
            <a
              href={`https://${state.domain}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border-2 border-black px-5 py-2.5 text-sm font-black bg-white hover:bg-black/[0.04] transition"
            >
              פתח את החנות
            </a>
          )}
        </div>

        <button
          onClick={remove}
          disabled={busyRemove}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#c2421f] hover:underline disabled:opacity-50"
        >
          <IcoTrash c="#c2421f" s={14} />
          {busyRemove ? "מסיר..." : "הסר דומיין"}
        </button>
      </div>
    </section>
  );
}

function StatusPill({ status, polling }: { status: Status; polling: boolean }) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-black bg-[#d1f5d6] px-3 py-1 text-xs font-black text-[#0a5e2a]">
        <span className="w-2 h-2 rounded-full bg-[#0a5e2a]" />
        מחובר ופעיל
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-black bg-[#fff3cf] px-3 py-1 text-xs font-black text-[#7a5a00]">
        <span className="w-2 h-2 rounded-full bg-[#d9a000] animate-pulse" />
        {polling ? "בודק..." : "ממתין ל-DNS"}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-black bg-[#fde8e3] px-3 py-1 text-xs font-black text-[#c2421f]">
      <span className="w-2 h-2 rounded-full bg-[#c2421f]" />
      שגיאה
    </span>
  );
}

function PropagationBanner({ polling }: { polling: boolean }) {
  return (
    <div className="rounded-xl border-2 border-black bg-white p-3.5 flex items-start gap-3">
      <div className="flex-shrink-0 mt-0.5">
        {polling ? (
          <span
            aria-hidden
            className="block w-5 h-5 rounded-full border-[3px] border-black/15 border-t-black animate-spin"
          />
        ) : (
          <span
            aria-hidden
            className="block w-5 h-5 rounded-full border-2 border-black bg-[#fff3cf]"
          />
        )}
      </div>
      <div className="text-sm leading-relaxed">
        <div className="font-black mb-0.5">בודקים את ההגדרות שלך</div>
        <div className="text-black/70">
          תהליך החיבור כולל אימות DNS והנפקת תעודת SSL אוטומטית ע״י Vercel. זה
          לרוב לוקח <strong>בין דקה ל-30 דקות</strong>, ובמקרים נדירים עד שעה
          (תלוי כמה זמן לוקח לספק הדומיין שלך לעדכן את הרשומות בעולם). אנחנו
          בודקים אוטומטית כל כמה שניות — אפשר להישאר בדף או לחזור מאוחר יותר.
        </div>
      </div>
    </div>
  );
}

function DnsRow({ record }: { record: DnsRecord }) {
  const [copied, setCopied] = useState<"name" | "value" | null>(null);

  async function copy(s: string, which: "name" | "value") {
    try {
      await navigator.clipboard.writeText(s);
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <div className="rounded-xl border-2 border-black bg-white p-3 grid grid-cols-1 sm:grid-cols-[80px_1fr_2fr] gap-2 sm:gap-3 items-center">
      <div>
        <span className="inline-block rounded-md bg-black text-[#F8CB1E] font-mono text-xs font-black px-2 py-1">
          {record.type}
        </span>
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-black/50 font-bold mb-0.5">
          name / host
        </div>
        <button
          onClick={() => copy(record.name, "name")}
          className="flex items-center gap-1.5 text-sm font-mono break-all text-start hover:text-black/70"
          dir="ltr"
        >
          <span>{record.name}</span>
          {copied === "name" ? (
            <IcoCheck c="#0a5e2a" s={14} />
          ) : (
            <IcoCopy c="#11231a" s={14} />
          )}
        </button>
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-black/50 font-bold mb-0.5">
          value
        </div>
        <button
          onClick={() => copy(record.value, "value")}
          className="flex items-center gap-1.5 text-sm font-mono break-all text-start hover:text-black/70"
          dir="ltr"
        >
          <span>{record.value}</span>
          {copied === "value" ? (
            <IcoCheck c="#0a5e2a" s={14} />
          ) : (
            <IcoCopy c="#11231a" s={14} />
          )}
        </button>
      </div>
    </div>
  );
}
