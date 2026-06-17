import { cn } from "@/lib/cn";
import { ORDER_STATUS_META } from "@/lib/order-status";

/**
 * The V2 (black/yellow) order-status badge. Shared by the dashboard recent
 * orders and the order history so both look identical. `className` overrides
 * the display utility (defaults to inline-flex; the dashboard passes
 * "hidden sm:inline-flex" to hide it on mobile).
 */
export function OrderStatusBadgeV2({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const meta = ORDER_STATUS_META[status] ?? { label: status, tone: "idle" as const };
  const base = cn(
    "items-center gap-1.5 text-[10px] font-black uppercase tracking-wide px-2 py-1 rounded-md border-2",
    className ?? "inline-flex",
  );

  if (meta.tone === "waiting") {
    return (
      <span className={cn(base, "border-black text-black")} style={{ backgroundColor: "#fff1d6" }}>
        {meta.label}
      </span>
    );
  }
  if (meta.tone === "approved") {
    return (
      <span className={cn(base, "border-black")} style={{ backgroundColor: "#e7f5ec", color: "#0a5d2d" }}>
        {meta.label}
      </span>
    );
  }
  if (meta.tone === "active") {
    return (
      <span className={cn(base, "border-black text-black")} style={{ backgroundColor: "#F8CB1E" }}>
        <span className="relative inline-flex w-1.5 h-1.5">
          <span className="absolute inline-flex w-full h-full rounded-full bg-green-500 opacity-75 animate-ping" />
          <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-green-600" />
        </span>
        {meta.label}
      </span>
    );
  }
  if (meta.tone === "transit") {
    return (
      <span className={cn(base, "border-black bg-white text-black")}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#F8CB1E" }} />
        {meta.label}
      </span>
    );
  }
  if (meta.tone === "done") {
    return (
      <span className={cn(base, "border-black bg-black")} style={{ color: "#F8CB1E" }}>
        {meta.label}
      </span>
    );
  }
  if (meta.tone === "canceled") {
    return (
      <span
        className={cn(
          base,
          "border-dashed border-black/30 bg-transparent text-black/45 line-through decoration-black/40",
        )}
      >
        {meta.label}
      </span>
    );
  }
  // idle - clean black-bordered white pill
  return <span className={cn(base, "border-black bg-white text-black")}>{meta.label}</span>;
}
