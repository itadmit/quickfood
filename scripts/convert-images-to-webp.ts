/**
 * One-shot migration: convert every image referenced in the DB to WebP in R2.
 *
 * Walks all image-bearing fields, downloads each non-webp object from R2,
 * re-encodes with sharp at quality 85 (max 2000px on the longest side),
 * uploads the new .webp key, updates the DB row to point at the new URL,
 * then deletes the original object from R2.
 *
 * Covered fields (7 total across 5 models):
 *   Tenant.logoUrl, Tenant.coverImage
 *   MenuItem.imageUrl, MenuItem.images[]
 *   ItemOption.imageUrl
 *   ModifierSetOption.imageUrl
 *   Campaign.imageUrl
 *
 * Run dry-run first:   npx tsx scripts/convert-images-to-webp.ts
 * Apply for real:      npx tsx scripts/convert-images-to-webp.ts --apply
 *
 * Required env (.env.local): DATABASE_URL, R2_ACCOUNT_ID, R2_BUCKET,
 *   R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_PUBLIC_URL.
 */
import { loadEnvConfig } from "@next/env";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";

loadEnvConfig(process.cwd());

const APPLY = process.argv.includes("--apply");

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const BUCKET = process.env.R2_BUCKET;
const PUBLIC_URL = (process.env.R2_PUBLIC_URL || "").replace(/\/$/, "");

if (!ACCOUNT_ID || !BUCKET || !PUBLIC_URL) {
  console.error("Missing R2_ACCOUNT_ID / R2_BUCKET / R2_PUBLIC_URL in .env.local");
  process.exit(1);
}

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
});

const prisma = new PrismaClient();

interface Stats {
  scanned: number;
  skipped: number;
  converted: number;
  failed: number;
  bytesIn: number;
  bytesOut: number;
}

const stats: Stats = {
  scanned: 0,
  skipped: 0,
  converted: 0,
  failed: 0,
  bytesIn: 0,
  bytesOut: 0,
};

function keyFromUrl(url: string): string | null {
  if (!url) return null;
  if (!url.startsWith(PUBLIC_URL + "/")) return null;
  return url.slice(PUBLIC_URL.length + 1);
}

function isWebP(url: string): boolean {
  // Strip query string before checking the extension.
  const path = url.split("?")[0].toLowerCase();
  return path.endsWith(".webp");
}

/**
 * Convert one image URL. Returns the new URL on success, the original URL
 * if the conversion was skipped (already webp / unknown origin / failure),
 * so callers can write back unconditionally without breaking the row.
 */
async function convertOne(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  stats.scanned += 1;

  if (isWebP(url)) {
    stats.skipped += 1;
    return url;
  }

  const oldKey = keyFromUrl(url);
  if (!oldKey) {
    console.warn(`  skip — non-R2 URL: ${url}`);
    stats.skipped += 1;
    return url;
  }

  try {
    const obj = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: oldKey }));
    const bytes = await obj.Body!.transformToByteArray();
    const buf = Buffer.from(bytes);
    stats.bytesIn += buf.length;

    const webpBuf = await sharp(buf)
      .rotate() // honor EXIF orientation so portrait phone photos don't flip
      .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
    stats.bytesOut += webpBuf.length;

    const newKey = oldKey.replace(/\.[^.]+$/, ".webp");
    const newUrl = `${PUBLIC_URL}/${newKey}`;

    if (!APPLY) {
      console.log(
        `  [dry] ${oldKey} (${(buf.length / 1024).toFixed(0)}KB) → ${newKey} (${(webpBuf.length / 1024).toFixed(0)}KB)`,
      );
      stats.converted += 1;
      return newUrl;
    }

    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: newKey,
        Body: webpBuf,
        ContentType: "image/webp",
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );

    // Delete the original only after the new key uploaded successfully.
    // If `newKey === oldKey` (same name + .webp extension already), skip
    // the delete so we don't nuke what we just wrote.
    if (newKey !== oldKey) {
      await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: oldKey }));
    }

    console.log(
      `  ✓ ${oldKey} (${(buf.length / 1024).toFixed(0)}KB) → ${newKey} (${(webpBuf.length / 1024).toFixed(0)}KB)`,
    );
    stats.converted += 1;
    return newUrl;
  } catch (e) {
    console.error(`  ✗ ${oldKey} — ${e instanceof Error ? e.message : String(e)}`);
    stats.failed += 1;
    return url; // leave the row untouched on failure
  }
}

async function migrateTenants() {
  console.log("\n— Tenant (logoUrl + coverImage)");
  const rows = await prisma.tenant.findMany({
    select: { id: true, logoUrl: true, coverImage: true },
  });
  for (const r of rows) {
    const nextLogo = await convertOne(r.logoUrl);
    const nextCover = await convertOne(r.coverImage);
    if (APPLY) {
      const patch: { logoUrl?: string | null; coverImage?: string | null } = {};
      if (nextLogo !== r.logoUrl) patch.logoUrl = nextLogo;
      if (nextCover !== r.coverImage) patch.coverImage = nextCover;
      if (Object.keys(patch).length) {
        await prisma.tenant.update({ where: { id: r.id }, data: patch });
      }
    }
  }
}

async function migrateMenuItems() {
  console.log("\n— MenuItem (imageUrl + images[])");
  const rows = await prisma.menuItem.findMany({
    select: { id: true, imageUrl: true, images: true },
  });
  for (const r of rows) {
    const nextImageUrl = await convertOne(r.imageUrl);
    const nextImages: string[] = [];
    let imagesChanged = false;
    for (const u of r.images) {
      const next = await convertOne(u);
      if (next && next !== u) imagesChanged = true;
      nextImages.push(next ?? u);
    }
    if (APPLY) {
      const patch: { imageUrl?: string | null; images?: string[] } = {};
      if (nextImageUrl !== r.imageUrl) patch.imageUrl = nextImageUrl;
      if (imagesChanged) patch.images = nextImages;
      if (Object.keys(patch).length) {
        await prisma.menuItem.update({ where: { id: r.id }, data: patch });
      }
    }
  }
}

async function migrateItemOptions() {
  console.log("\n— ItemOption (imageUrl)");
  const rows = await prisma.itemOption.findMany({
    select: { id: true, imageUrl: true },
  });
  for (const r of rows) {
    const next = await convertOne(r.imageUrl);
    if (APPLY && next !== r.imageUrl) {
      await prisma.itemOption.update({ where: { id: r.id }, data: { imageUrl: next } });
    }
  }
}

async function migrateModifierSetOptions() {
  console.log("\n— ModifierSetOption (imageUrl)");
  const rows = await prisma.modifierSetOption.findMany({
    select: { id: true, imageUrl: true },
  });
  for (const r of rows) {
    const next = await convertOne(r.imageUrl);
    if (APPLY && next !== r.imageUrl) {
      await prisma.modifierSetOption.update({ where: { id: r.id }, data: { imageUrl: next } });
    }
  }
}

async function migrateCampaigns() {
  console.log("\n— Campaign (imageUrl)");
  const rows = await prisma.campaign.findMany({
    select: { id: true, imageUrl: true },
  });
  for (const r of rows) {
    const next = await convertOne(r.imageUrl);
    if (APPLY && next !== r.imageUrl) {
      await prisma.campaign.update({ where: { id: r.id }, data: { imageUrl: next } });
    }
  }
}

async function main() {
  console.log(
    APPLY
      ? "Converting images → WebP (APPLY mode — will write to R2 + DB and delete originals).\n"
      : "Dry run — no R2 or DB writes. Re-run with --apply to actually convert.\n",
  );

  await migrateTenants();
  await migrateMenuItems();
  await migrateItemOptions();
  await migrateModifierSetOptions();
  await migrateCampaigns();

  const savedKB = (stats.bytesIn - stats.bytesOut) / 1024;
  const ratio = stats.bytesIn > 0 ? (stats.bytesOut / stats.bytesIn) * 100 : 0;
  console.log("\n— Summary");
  console.log(`  Scanned:   ${stats.scanned}`);
  console.log(`  Converted: ${stats.converted}`);
  console.log(`  Skipped:   ${stats.skipped}`);
  console.log(`  Failed:    ${stats.failed}`);
  console.log(`  Bytes in:  ${(stats.bytesIn / 1024).toFixed(0)}KB`);
  console.log(`  Bytes out: ${(stats.bytesOut / 1024).toFixed(0)}KB`);
  console.log(`  Saved:     ${savedKB.toFixed(0)}KB (new size ${ratio.toFixed(1)}% of original)`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
