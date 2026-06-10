"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCart } from "@/components/customer/CartProvider";
import { readRecentOrderIds } from "@/lib/recent-orders-storage";
import { IcoClose } from "@/components/shared/Icons";
import { AIMessageList } from "./AIMessageList";
import { AIComposer } from "./AIComposer";
import type { AIChatMessage, AIProposal, AIRecommendItem, AIToolCall } from "./types";

interface StreamPart {
  kind: "text" | "tool" | "done" | "error";
  text?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  error?: string;
}

interface RecentOrderItem {
  name: string;
  quantity: number;
}

interface RecentOrderForAI {
  orderNumber?: string | number;
  createdAt: string;
  items: RecentOrderItem[];
}

const SUGGESTIONS = [
  "מה אתה ממליץ ליחיד?",
  "ארוחה לזוג עד 120 ₪",
  "משהו טבעוני",
  "אני אוהב חריף",
];

const STORAGE_PREFIX = "qf:ai-chat:";

interface PersistedChat {
  messages: AIChatMessage[];
  recommendItems: Array<[string, AIRecommendItem]>;
  proposals: Array<[string, AIProposal]>;
}

function loadChat(tenantSlug: string): PersistedChat | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + tenantSlug);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedChat;
    parsed.messages = (parsed.messages ?? []).map((m) =>
      m.pending ? { ...m, pending: false } : m,
    );
    return parsed;
  } catch {
    return null;
  }
}

function saveChat(tenantSlug: string, data: PersistedChat) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_PREFIX + tenantSlug, JSON.stringify(data));
  } catch {
    /* quota or disabled - ignore */
  }
}

function clearChat(tenantSlug: string) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_PREFIX + tenantSlug);
  } catch {
    /* ignore */
  }
}

export function AIAdvisorModal({
  tenantSlug,
  onClose,
  suggestions,
}: {
  tenantSlug: string;
  onClose: () => void;
  suggestions?: string[];
}) {
  const activeSuggestions = suggestions && suggestions.length > 0 ? suggestions : SUGGESTIONS;
  const cart = useCart();
  const [messages, setMessages] = useState<AIChatMessage[]>(() => loadChat(tenantSlug)?.messages ?? []);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrderForAI[]>([]);
  const [recommendMap, setRecommendMap] = useState<Map<string, AIRecommendItem>>(
    () => new Map(loadChat(tenantSlug)?.recommendItems ?? []),
  );
  const [proposalMap, setProposalMap] = useState<Map<string, AIProposal>>(
    () => new Map(loadChat(tenantSlug)?.proposals ?? []),
  );
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    saveChat(tenantSlug, {
      messages,
      recommendItems: Array.from(recommendMap.entries()),
      proposals: Array.from(proposalMap.entries()),
    });
  }, [tenantSlug, messages, recommendMap, proposalMap]);

  const startNewChat = useCallback(() => {
    abortRef.current?.abort();
    clearChat(tenantSlug);
    setMessages([]);
    setRecommendMap(new Map());
    setProposalMap(new Map());
    setError(null);
    setStreaming(false);
  }, [tenantSlug]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      abortRef.current?.abort();
    };
  }, [onClose]);

  useEffect(() => {
    const ids = readRecentOrderIds(tenantSlug);
    const ctrl = new AbortController();
    const idsParam = ids.length > 0 ? `&ids=${encodeURIComponent(ids.slice(0, 5).join(","))}` : "";
    fetch(
      `/api/v1/customer/ai/recent-orders?tenant=${encodeURIComponent(tenantSlug)}${idsParam}`,
      { signal: ctrl.signal },
    )
      .then((r) => r.json())
      .then((data: { orders?: Array<{ number?: string | number; createdAt: string; items: Array<{ name: string; quantity: number }> }> }) => {
        setRecentOrders(
          (data.orders ?? []).map((o) => ({
            orderNumber: o.number,
            createdAt: o.createdAt,
            items: o.items.map((i) => ({ name: i.name, quantity: i.quantity })),
          })),
        );
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [tenantSlug]);

  const currentCartSnapshot = useMemo(
    () =>
      cart.lines.map((l) => ({
        name: l.name,
        quantity: l.quantity,
        sizeName: l.sizeName,
        options: l.options.map((o) => o.name),
      })),
    [cart.lines],
  );

  const addProposalToCart = useCallback(
    (toolCallId: string) => {
      const proposal = proposalMap.get(toolCallId);
      if (!proposal) return false;
      cart.add({
        itemId: proposal.itemId,
        name: proposal.itemName,
        basePrice: proposal.basePrice,
        artType: null,
        imageUrl: proposal.imageUrl,
        quantity: proposal.quantity,
        sizeId: proposal.sizeId,
        sizeName: proposal.sizeName,
        sizeDelta: proposal.sizeDelta,
        options: proposal.options,
        notes: proposal.notes,
        source: "ai_advisor",
      });
      setMessages((prev) =>
        prev.map((m) =>
          m.toolCalls?.some((tc) => tc.id === toolCallId)
            ? {
                ...m,
                toolCalls: m.toolCalls.map((tc) =>
                  tc.id === toolCallId ? { ...tc, resolved: true } : tc,
                ),
              }
            : m,
        ),
      );
      return true;
    },
    [cart, proposalMap],
  );

  const handleAddProposal = useCallback(
    (toolCallId: string) => {
      addProposalToCart(toolCallId);
    },
    [addProposalToCart],
  );

  const handleAddProposalAndCheckout = useCallback(
    (toolCallId: string) => {
      if (addProposalToCart(toolCallId)) {
        onClose();
        window.location.href = `/s/${tenantSlug}/cart`;
      }
    },
    [addProposalToCart, onClose, tenantSlug],
  );

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || streaming) return;

      setError(null);
      const userMsg: AIChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        text: trimmed,
      };
      const modelMsg: AIChatMessage = {
        id: crypto.randomUUID(),
        role: "model",
        text: "",
        toolCalls: [],
        pending: true,
      };
      const historyForAPI = messages.map((m) => ({ role: m.role, text: m.text }));

      setMessages((prev) => [...prev, userMsg, modelMsg]);
      setStreaming(true);

      const ctrl = new AbortController();
      abortRef.current = ctrl;

      try {
        const res = await fetch("/api/v1/customer/ai/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          signal: ctrl.signal,
          body: JSON.stringify({
            tenant_slug: tenantSlug,
            messages: historyForAPI,
            message: trimmed,
            recent_orders: recentOrders,
            current_cart: currentCartSnapshot,
            cart_subtotal: cart.subtotal,
          }),
        });

        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error?.message ?? "תקלת תקשורת עם היועץ");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";

        const newRecommendItems = new Map(recommendMap);
        const newProposals = new Map(proposalMap);

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n\n");
          buf = lines.pop() ?? "";
          for (const block of lines) {
            const line = block.split("\n").find((l) => l.startsWith("data: "));
            if (!line) continue;
            let parsed: StreamPart;
            try {
              parsed = JSON.parse(line.slice(6));
            } catch {
              continue;
            }
            if (parsed.kind === "text" && parsed.text) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === modelMsg.id ? { ...m, text: m.text + parsed.text } : m,
                ),
              );
            } else if (parsed.kind === "tool") {
              const toolCall: AIToolCall = {
                id: crypto.randomUUID(),
                name: parsed.toolName ?? "",
                args: parsed.toolArgs ?? {},
              };

              if (toolCall.name === "recommend_items") {
                const ids = (toolCall.args.item_ids as string[] | undefined) ?? [];
                const items = await fetchRecommendItems(tenantSlug, ids);
                for (const it of items) newRecommendItems.set(it.id, it);
                setRecommendMap(new Map(newRecommendItems));
              } else if (toolCall.name === "propose_add_to_cart") {
                const proposal = await fetchProposal(tenantSlug, toolCall.args);
                if (proposal) {
                  newProposals.set(toolCall.id, proposal);
                  setProposalMap(new Map(newProposals));
                }
              }

              setMessages((prev) =>
                prev.map((m) =>
                  m.id === modelMsg.id
                    ? { ...m, toolCalls: [...(m.toolCalls ?? []), toolCall] }
                    : m,
                ),
              );
            } else if (parsed.kind === "error") {
              throw new Error(parsed.error ?? "שגיאת מודל");
            }
          }
        }

        setMessages((prev) =>
          prev.map((m) => (m.id === modelMsg.id ? { ...m, pending: false } : m)),
        );
      } catch (err) {
        // Intentional cancel (start-new-chat / modal close aborts the
        // in-flight request) surfaces as an AbortError / "BodyStreamBuffer
        // was aborted" - not a real failure, so don't show it to the user.
        if (ctrl.signal.aborted) return;
        const msg = err instanceof Error ? err.message : "תקלה";
        setError(msg);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === modelMsg.id
              ? { ...m, pending: false, text: m.text || "מצטער, התקלה לא אפשרה לי לענות עכשיו." }
              : m,
          ),
        );
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [messages, streaming, tenantSlug, recentOrders, currentCartSnapshot, cart.subtotal, recommendMap, proposalMap],
  );

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/40 grid place-items-end sm:place-items-center p-0 sm:p-4 animate-qf-modal-in"
      role="dialog"
      aria-modal
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-qf-bg w-full max-w-md h-[100dvh] sm:h-[85vh] sm:max-h-[700px] sm:rounded-3xl sm:border-2 sm:border-black sm:shadow-[0_4px_0_#000] overflow-hidden flex flex-col">
      <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-qf-line-soft bg-white">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-black text-(--qf-yolk) flex items-center justify-center">
            <SparkleSm />
          </div>
          <div>
            <div className="font-bold text-sm leading-tight">היועץ של {cart.tenant.name}</div>
            <div className="text-xs text-qf-mute leading-tight">מבוסס AI · ממליץ לפי התפריט</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (streaming || confirm("להתחיל שיחה חדשה? ההתכתבות הנוכחית תימחק.")) {
                  startNewChat();
                }
              }}
              aria-label="שיחה חדשה"
              title="שיחה חדשה"
              className="w-9 h-9 rounded-full hover:bg-qf-line-soft flex items-center justify-center"
            >
              <RestartIcon />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="סגור"
            className="w-9 h-9 rounded-full hover:bg-qf-line-soft flex items-center justify-center"
          >
            <IcoClose s={20} />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <EmptyState
            tenantName={cart.tenant.name}
            suggestions={activeSuggestions}
            onPick={(text) => send(text)}
          />
        ) : (
          <AIMessageList
            messages={messages}
            recommendMap={recommendMap}
            proposalMap={proposalMap}
            onAddProposal={handleAddProposal}
            onAddProposalAndCheckout={handleAddProposalAndCheckout}
            onClose={onClose}
          />
        )}
      </div>

      {cart.itemCount > 0 && (
        <CartStrip
          itemCount={cart.itemCount}
          subtotal={cart.subtotal}
          minOrder={cart.branch?.minOrder ?? 0}
          onGo={() => {
            onClose();
            window.location.href = `/s/${tenantSlug}/cart`;
          }}
        />
      )}

      <AIComposer
        disabled={streaming}
        onSend={send}
        suggestions={messages.length === 0 ? activeSuggestions : []}
        error={error}
      />
      </div>
    </div>
  );
}

function CartStrip({
  itemCount,
  subtotal,
  minOrder,
  onGo,
}: {
  itemCount: number;
  subtotal: number;
  minOrder: number;
  onGo: () => void;
}) {
  const remaining = minOrder > 0 ? Math.max(0, minOrder - subtotal) : 0;
  const meetsMin = remaining === 0;
  return (
    <div className="border-t-2 border-black bg-white">
      <div className="px-4 py-2.5 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-black leading-tight">
            {itemCount} פריטים בעגלה · ₪{subtotal.toLocaleString("he-IL")}
          </div>
          {minOrder > 0 && (
            <div
              className={
                meetsMin
                  ? "text-[11px] text-qf-green-deep font-medium leading-tight mt-0.5"
                  : "text-[11px] text-qf-tomato font-medium leading-tight mt-0.5"
              }
            >
              {meetsMin
                ? `עברת את המינימום (₪${minOrder.toLocaleString("he-IL")})`
                : `חסר ₪${remaining.toLocaleString("he-IL")} למינימום הזמנה`}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onGo}
          className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-(--qf-primary) text-white text-xs font-black border-2 border-(--qf-deep) hover:bg-(--qf-deep) transition"
          style={{ boxShadow: "2px 2px 0 0 var(--qf-deep)" }}
        >
          מעבר לעגלה
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function EmptyState({
  tenantName,
  suggestions,
  onPick,
}: {
  tenantName: string;
  suggestions: string[];
  onPick: (text: string) => void;
}) {
  return (
    <div className="max-w-md mx-auto px-4 py-10 flex flex-col items-center text-center">
      <div className="w-16 h-16 rounded-full bg-black text-(--qf-yolk) flex items-center justify-center mb-4">
        <SparkleSm s={28} />
      </div>
      <h2 className="text-xl font-black mb-1">היי, אני היועץ של {tenantName}</h2>
      <p className="text-sm text-qf-mute leading-relaxed max-w-xs">
        תגיד לי מה בא לך, על איזה תקציב או הגבלות תזונה - אני ממליץ ומרכיב לך הזמנה.
      </p>
      <div className="mt-6 grid grid-cols-2 gap-2 w-full">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="text-center bg-white text-sm font-medium px-3 py-2.5 rounded-2xl border border-qf-line-dash hover:border-black transition"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function RestartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </svg>
  );
}

function SparkleSm({ s = 18 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="#ffffff" aria-hidden>
      <path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3z" />
      <path d="M19 14l.9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14z" />
    </svg>
  );
}

async function fetchRecommendItems(tenantSlug: string, ids: string[]): Promise<AIRecommendItem[]> {
  if (ids.length === 0) return [];
  try {
    const res = await fetch(
      `/api/v1/customer/ai/items?tenant=${encodeURIComponent(tenantSlug)}&ids=${encodeURIComponent(ids.join(","))}`,
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { items?: AIRecommendItem[] };
    return data.items ?? [];
  } catch {
    return [];
  }
}

async function fetchProposal(
  tenantSlug: string,
  args: Record<string, unknown>,
): Promise<AIProposal | null> {
  try {
    const res = await fetch("/api/v1/customer/ai/resolve-proposal", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant_slug: tenantSlug, ...args }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { proposal?: AIProposal };
    return data.proposal ?? null;
  } catch {
    return null;
  }
}
