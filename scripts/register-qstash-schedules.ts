/**
 * One-shot script — register (upsert) the recurring QStash schedules that
 * QuickFood needs. Replaces what used to live in vercel.json.
 *
 *   $ npx tsx scripts/register-qstash-schedules.ts
 *
 * Required env (read from .env.local in dev, Vercel envs in prod):
 *   QSTASH_URL, QSTASH_TOKEN          — to talk to the QStash control plane
 *   NEXT_PUBLIC_APP_URL               — the public origin QStash should call
 *                                       (e.g. https://quickfood.co.il)
 *
 * Re-runs are safe: each schedule is keyed by a stable `scheduleId`, so this
 * upserts rather than duplicates.
 */
import { upsertSchedule, listSchedules } from "../lib/qstash/client";

interface Job {
  scheduleId: string;
  path: string;
  cron: string;
  description: string;
}

const JOBS: Job[] = [
  {
    scheduleId: "quickfood-webhooks-process",
    path: "/api/internal/webhooks/process",
    cron: "* * * * *",
    description: "Process pending outbound webhook deliveries (POS / printers / Slack).",
  },
];

async function main() {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  if (!base) {
    console.error("NEXT_PUBLIC_APP_URL must be set (e.g. https://quickfood.co.il).");
    process.exit(1);
  }
  if (base.startsWith("http://localhost") || base.startsWith("http://127.")) {
    console.error(
      `Refusing to register schedules pointing at ${base} — QStash can't reach localhost.\n` +
      `Set NEXT_PUBLIC_APP_URL to your public domain (e.g. https://quickfood.co.il) before running.`,
    );
    process.exit(1);
  }

  console.log(`[qstash] registering ${JOBS.length} schedule(s) against ${base} …\n`);

  for (const job of JOBS) {
    const url = `${base}${job.path}`;
    try {
      const { scheduleId } = await upsertSchedule({
        scheduleId: job.scheduleId,
        url,
        cron: job.cron,
        method: "POST",
      });
      console.log(`  ✓ ${job.scheduleId}`);
      console.log(`      → ${url}`);
      console.log(`      cron: ${job.cron}`);
      console.log(`      ${job.description}`);
      if (scheduleId && scheduleId !== job.scheduleId) {
        console.log(`      (qstash returned id: ${scheduleId})`);
      }
      console.log("");
    } catch (err) {
      console.error(`  ✗ ${job.scheduleId} failed:`, err);
      process.exitCode = 1;
    }
  }

  // Print the current state on the QStash side so we can eyeball it.
  try {
    const all = await listSchedules();
    console.log(`[qstash] account currently has ${all.length} schedule(s):`);
    for (const s of all) {
      console.log(`  • ${s.scheduleId}  cron=${s.cron}  →  ${s.destination}`);
    }
  } catch (err) {
    console.warn("[qstash] could not list schedules:", err);
  }
}

main().catch((err) => {
  console.error("[qstash] script threw:", err);
  process.exit(1);
});
