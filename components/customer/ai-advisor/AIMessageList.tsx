"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { IcoCheck, IcoPlus } from "@/components/shared/Icons";
import { formatPrice } from "@/lib/format";
import type { AIChatMessage, AIProposal, AIRecommendItem } from "./types";

interface Props {
  messages: AIChatMessage[];
  recommendMap: Map<string, AIRecommendItem>;
  proposalMap: Map<string, AIProposal>;
  onAddProposal: (toolCallId: string) => void;
  onClose: () => void;
}

export function AIMessageList({
  messages,
  recommendMap,
  proposalMap,
  onAddProposal,
  onClose,
}: Props) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  return (
    <div className="max-w-md mx-auto px-3 py-4 space-y-4">
      {messages.map((m) => (
        <MessageBubble
          key={m.id}
          message={m}
          recommendMap={recommendMap}
          proposalMap={proposalMap}
          onAddProposal={onAddProposal}
          onClose={onClose}
        />
      ))}
      <div ref={endRef} />
    </div>
  );
}

function MessageBubble({
  message,
  recommendMap,
  proposalMap,
  onAddProposal,
  onClose,
}: {
  message: AIChatMessage;
  recommendMap: Map<string, AIRecommendItem>;
  proposalMap: Map<string, AIProposal>;
  onAddProposal: (toolCallId: string) => void;
  onClose: () => void;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-start">
        <div className="bg-black text-white rounded-2xl rounded-bl-md px-4 py-2.5 text-sm max-w-[85%] whitespace-pre-wrap">
          {message.text}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {(message.text || message.pending) && (
        <div className="flex justify-end">
          <div className="bg-white border border-qf-line-dash rounded-2xl rounded-br-md px-4 py-2.5 text-sm max-w-[85%] whitespace-pre-wrap">
            {message.text}
            {message.pending && !message.text && <TypingDots />}
            {message.pending && message.text && <span className="inline-block w-1 h-4 align-middle bg-black/40 animate-pulse mr-1" />}
          </div>
        </div>
      )}

      {message.toolCalls?.map((tc) => {
        if (tc.name === "recommend_items") {
          const ids = (tc.args.item_ids as string[] | undefined) ?? [];
          const items = ids
            .map((id) => recommendMap.get(id))
            .filter((i): i is AIRecommendItem => !!i);
          if (items.length === 0) return null;
          return (
            <div key={tc.id} className="grid grid-cols-2 gap-2">
              {items.map((it) => (
                <RecommendCard key={it.id} item={it} onClose={onClose} />
              ))}
            </div>
          );
        }
        if (tc.name === "propose_add_to_cart") {
          const proposal = proposalMap.get(tc.id);
          if (!proposal) return <div key={tc.id} className="text-xs text-qf-mute">מכין הצעה...</div>;
          return (
            <ProposalCard
              key={tc.id}
              proposal={proposal}
              resolved={!!tc.resolved}
              onAdd={() => onAddProposal(tc.id)}
            />
          );
        }
        return null;
      })}
    </div>
  );
}

function RecommendCard({ item, onClose }: { item: AIRecommendItem; onClose: () => void }) {
  return (
    <Link
      href={item.href}
      onClick={onClose}
      className="block bg-white border border-qf-line-dash rounded-2xl overflow-hidden hover:border-black transition"
    >
      {item.imageUrl ? (
        <div
          className="aspect-square bg-qf-line-soft"
          style={{ backgroundImage: `url(${item.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }}
        />
      ) : (
        <div className="aspect-square bg-qf-line-soft" />
      )}
      <div className="p-2.5">
        <div className="text-sm font-bold leading-tight line-clamp-2">{item.name}</div>
        <div className="text-xs text-qf-mute mt-0.5">{formatPrice(item.basePrice)}</div>
      </div>
    </Link>
  );
}

function ProposalCard({
  proposal,
  resolved,
  onAdd,
}: {
  proposal: AIProposal;
  resolved: boolean;
  onAdd: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const total = proposal.unitPrice * proposal.quantity;

  return (
    <div className="bg-white border-2 border-black rounded-2xl overflow-hidden shadow-sm">
      <div className="flex gap-3 p-3">
        {proposal.imageUrl ? (
          <div
            className="w-16 h-16 shrink-0 rounded-xl bg-qf-line-soft"
            style={{ backgroundImage: `url(${proposal.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }}
          />
        ) : (
          <div className="w-16 h-16 shrink-0 rounded-xl bg-qf-line-soft" />
        )}
        <div className="min-w-0 flex-1">
          <div className="font-bold text-sm leading-tight">
            {proposal.quantity > 1 ? `${proposal.quantity}× ` : ""}
            {proposal.itemName}
          </div>
          {proposal.sizeName && (
            <div className="text-xs text-qf-mute mt-0.5">{proposal.sizeName}</div>
          )}
          {proposal.options.length > 0 && (
            <div className="text-xs text-qf-mute mt-0.5 line-clamp-2">
              {proposal.options.map((o) => o.name).join(" · ")}
            </div>
          )}
          {proposal.notes && <div className="text-xs italic text-qf-mute mt-0.5">"{proposal.notes}"</div>}
        </div>
        <div className="text-sm font-bold tnum self-start">{formatPrice(total)}</div>
      </div>
      <button
        type="button"
        disabled={resolved || busy}
        onClick={() => {
          if (resolved || busy) return;
          setBusy(true);
          onAdd();
          setTimeout(() => setBusy(false), 400);
        }}
        className={
          resolved
            ? "w-full px-4 py-3 bg-qf-green-soft text-qf-green-deep font-bold text-sm flex items-center justify-center gap-1.5"
            : "w-full px-4 py-3 bg-black text-white font-bold text-sm flex items-center justify-center gap-1.5 hover:bg-black/85 transition"
        }
      >
        {resolved ? (
          <>
            <IcoCheck c="currentColor" s={14} />
            נוסף לעגלה
          </>
        ) : (
          <>
            <IcoPlus c="currentColor" s={14} />
            הוסף לעגלה · {formatPrice(total)}
          </>
        )}
      </button>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex gap-1 items-center" aria-label="חושב">
      <span className="w-1.5 h-1.5 rounded-full bg-qf-mute animate-bounce" style={{ animationDelay: "0ms" }} />
      <span className="w-1.5 h-1.5 rounded-full bg-qf-mute animate-bounce" style={{ animationDelay: "120ms" }} />
      <span className="w-1.5 h-1.5 rounded-full bg-qf-mute animate-bounce" style={{ animationDelay: "240ms" }} />
    </span>
  );
}
