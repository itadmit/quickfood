/**
 * One-shot backfill: turn on the free-email order notifications for every
 * ACTIVE store (product decision 2026-07-19).
 *
 *   $ npx tsx --env-file=.env.local scripts/backfill-email-notify-defaults.ts          # dry-run
 *   $ npx tsx --env-file=.env.local scripts/backfill-email-notify-defaults.ts --apply  # execute
 *
 * For each active tenant we enable email on `confirmed`, `ready`, and
 * `on_the_way` where the event is currently DISABLED. We never touch an event
 * that is already enabled (so a merchant's deliberate SMS/WhatsApp choice, or
 * an already-on paid channel, is preserved), and we leave `delivered` and the
 * merchant_new_order block exactly as they are.
 *
 * Tenants that never opened the messaging screen already get the new default
 * from the resolver at read-time; this backfill is for tenants who saved
 * settings before the change and therefore carry an explicit notifySettings
 * JSON that would otherwise pin the old (all-off) behaviour.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/db/client";
import {
  resolveOrderNotifySettings,
  resolveMerchantNewOrderSettings,
} from "../lib/messaging/notify-settings";

const APPLY = process.argv.includes("--apply");
const TARGET_EVENTS = ["confirmed", "ready", "on_the_way"] as const;

async function main() {
  const tenants = await prisma.tenant.findMany({
    where: { status: "active" },
    select: { id: true, name: true, notifySettings: true, notifyChannel: true },
  });

  let changed = 0;
  for (const t of tenants) {
    const current = resolveOrderNotifySettings(t.notifySettings, t.notifyChannel);
    const next = { ...current };
    const turnedOn: string[] = [];

    for (const ev of TARGET_EVENTS) {
      if (!current[ev].enabled) {
        next[ev] = { enabled: true, channel: "email", text: current[ev].text ?? null };
        turnedOn.push(ev);
      }
    }

    if (turnedOn.length === 0) continue;
    changed++;
    console.log(`${APPLY ? "UPDATE" : "would update"} ${t.name} → +email: ${turnedOn.join(", ")}`);

    if (APPLY) {
      await prisma.tenant.update({
        where: { id: t.id },
        data: {
          notifySettings: {
            ...next,
            merchant_new_order: resolveMerchantNewOrderSettings(t.notifySettings),
          } as unknown as Prisma.InputJsonValue,
        },
      });
    }
  }

  console.log(
    `\n${APPLY ? "Applied" : "Dry-run"}: ${changed}/${tenants.length} active tenants ${APPLY ? "updated" : "would change"}.`,
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
