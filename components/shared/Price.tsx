import { formatPrice } from "@/lib/format";

export function Price({ amount, originalAmount }: { amount: number; originalAmount?: number | null }) {
  return <span className="inline-flex flex-wrap items-baseline gap-x-2 tnum">
    {originalAmount != null && originalAmount > amount && <del className="text-[0.8em] font-normal opacity-65" aria-label="מחיר לפני הנחה">{formatPrice(originalAmount)}</del>}
    <span>{formatPrice(amount)}</span>
  </span>;
}
