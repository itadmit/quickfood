import { formatPrice } from "@/lib/format";
import { useLocale } from "@/components/customer/LocaleProvider";

type CartOpt = { name: string; groupName?: string; priceDelta: number; groupId?: string; optionId?: string };

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
  const { tc } = useLocale();
  if (!options.length) return null;
  const size = compact ? "text-[11px]" : "text-xs";

  // The same option picked multiple times arrives as repeated entries
  // (possibly with different unit prices when some units were included
  // free) - collapse them to one "3× טחינה" row with the summed charge.
  const order: string[] = [];
  const byGroup = new Map<string, Array<CartOpt & { count: number }>>();
  for (const raw of options) {
    const o = {
      ...raw,
      name: raw.optionId ? tc(`item_option:${raw.optionId}:name`, raw.name) : raw.name,
      groupName:
        raw.groupName && raw.groupId ? tc(`option_group:${raw.groupId}:name`, raw.groupName) : raw.groupName,
    };
    const g = o.groupName ?? "";
    if (!byGroup.has(g)) {
      byGroup.set(g, []);
      order.push(g);
    }
    const rows = byGroup.get(g)!;
    const existing = rows.find((r) => r.name === o.name);
    if (existing) {
      existing.count += 1;
      existing.priceDelta += o.priceDelta;
    } else {
      rows.push({ ...o, count: 1 });
    }
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
                {o.count > 1 ? `${o.count}× ` : ""}
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
