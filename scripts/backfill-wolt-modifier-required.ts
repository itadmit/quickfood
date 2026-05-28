/**
 * One-shot backfill for Wolt-imported ModifierSets.
 *
 *   $ npx tsx scripts/backfill-wolt-modifier-required.ts        # dry-run
 *   $ npx tsx scripts/backfill-wolt-modifier-required.ts --apply
 *
 * Older Wolt imports created ModifierSets without copying Wolt's
 * minimum_total_selections / maximum_total_selections / free_selections
 * onto the catalog set — those columns took their schema defaults
 * (required=false, min=0, max=5, includedFree=0). The runtime serializer
 * always reads the set values first (fromSet?.required ?? g.required),
 * so the real Wolt config that landed on per-item ItemOptionGroup rows
 * was effectively ignored.
 *
 * This script walks each tenant's most-recent committed WoltImport,
 * parses rawMenu, and for every ModifierSet (externalSource='wolt')
 * whose required/min/max are still at the defaults, copies the first
 * referencing item's config onto the set. Sets the merchant has already
 * edited (any non-default) are skipped untouched.
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { Prisma } from "@prisma/client";
import { prisma } from "../lib/db/client";
import type { WoltMenu, WoltOptionGroupRefOnItem } from "../lib/wolt-import/types";

const APPLY = process.argv.includes("--apply");

async function main() {
  const imports = await prisma.woltImport.findMany({
    where: { status: "committed", rawMenu: { not: Prisma.DbNull } },
    orderBy: [{ tenantId: "asc" }, { createdAt: "desc" }],
  });

  const latestByTenant = new Map<string, (typeof imports)[number]>();
  for (const row of imports) {
    if (!latestByTenant.has(row.tenantId)) latestByTenant.set(row.tenantId, row);
  }

  let touched = 0;
  let skippedCustomized = 0;
  let skippedNoRef = 0;

  for (const [tenantId, row] of latestByTenant) {
    const menu = row.rawMenu as unknown as WoltMenu | null;
    if (!menu) continue;

    const firstRefByGroup = new Map<string, WoltOptionGroupRefOnItem>();
    for (const it of menu.items) {
      for (const ref of it.options ?? []) {
        const groupId = ref.parent ?? ref.id;
        if (!firstRefByGroup.has(groupId)) firstRefByGroup.set(groupId, ref);
      }
    }

    const sets = await prisma.modifierSet.findMany({
      where: { tenantId, externalSource: "wolt" },
    });

    for (const s of sets) {
      // Protect merchant edits: if they've promoted the set to required=true
      // in the catalog UI, never overwrite. Everything else is fair game —
      // the buggy importer left these at semi-random values and we want
      // them to match Wolt.
      if (s.required === true) {
        skippedCustomized += 1;
        continue;
      }
      const ref = s.externalId ? firstRefByGroup.get(s.externalId) : null;
      if (!ref) {
        skippedNoRef += 1;
        continue;
      }
      const minSel = ref.minimum_total_selections ?? 0;
      const maxSel = ref.maximum_total_selections ?? 5;
      const required = minSel > 0;
      const includedFree = ref.free_selections ?? 0;

      const noOp =
        s.required === required &&
        s.minSelect === minSel &&
        s.maxSelect === maxSel &&
        s.includedFree === includedFree;
      if (noOp) continue;

      console.log(
        `[${APPLY ? "apply" : "dry"}] tenant=${tenantId} set="${s.name}"  ` +
          `required ${s.required}→${required}  min ${s.minSelect}→${minSel}  ` +
          `max ${s.maxSelect}→${maxSel}  free ${s.includedFree}→${includedFree}`,
      );
      if (APPLY) {
        await prisma.modifierSet.update({
          where: { id: s.id },
          data: { required, minSelect: minSel, maxSelect: maxSel, includedFree },
        });
      }
      touched += 1;
    }
  }

  console.log(
    `\n${APPLY ? "Updated" : "Would update"} ${touched} set(s). Skipped ${skippedCustomized} customized, ${skippedNoRef} with no Wolt ref. Tenants scanned: ${latestByTenant.size}.`,
  );
  if (!APPLY) console.log("Re-run with --apply to commit.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
