import { formatPrice } from "@/lib/format";

type CartOpt = { name: string; groupName?: string; priceDelta: number };

/**
 * Renders a cart line's selected options grouped under their modifier-group
 * name - the group label is shown once as a header and the chosen options are
 * listed beneath it, instead of repeating "<group>: <option>" on every row.
 * Options with no group name fall back to a plain list.
 */
export function CartLineOptions({
  options,
  compact,
}: {
  options: CartOpt[];
  compact?: boolean;
}) {
  if (!options.length) return null;
  const size = compact ? "text-[11px]" : "text-xs";

  const order: string[] = [];
  const byGroup = new Map<string, CartOpt[]>();
  for (const o of options) {
    const g = o.groupName ?? "";
    if (!byGroup.has(g)) {
      byGroup.set(g, []);
      order.push(g);
    }
    byGroup.get(g)!.push(o);
  }

  return (
    <div className="mt-0.5 space-y-1">
      {order.map((g) => (
        <div key={g}>
          {g && <div className={`${size} text-qf-mute font-medium`}>{g}:</div>}
          <div className={g ? "ps-2.5" : ""}>
            {byGroup.get(g)!.map((o, i) => (
              <div key={i} className={`${size} text-qf-mute`}>
                {g ? "– " : ""}
                {o.name}
                {o.priceDelta > 0 && <span> (+{formatPrice(o.priceDelta)})</span>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
