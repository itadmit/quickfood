/**
 * One-shot: apply CORS rules to the R2 bucket so the browser can PUT
 * directly to presigned URLs (used by components/shared/ImageUploader.tsx).
 *
 * Run:   npx tsx scripts/r2-cors.ts
 * Or:    npx tsx scripts/r2-cors.ts --get   (just print current rules)
 *
 * Edit ALLOWED_ORIGINS below before running in production.
 */
import { loadEnvConfig } from "@next/env";
import {
  S3Client,
  PutBucketCorsCommand,
  GetBucketCorsCommand,
} from "@aws-sdk/client-s3";

loadEnvConfig(process.cwd());

const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
  "https://quickfood.co.il",
  "https://www.quickfood.co.il",
  "https://quickfoodil.vercel.app",
  "https://*.vercel.app",
  process.env.NEXT_PUBLIC_APP_URL,
].filter((o): o is string => !!o);

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const BUCKET = process.env.R2_BUCKET;

if (!ACCOUNT_ID || !BUCKET) {
  console.error("Missing R2_ACCOUNT_ID or R2_BUCKET in .env.local");
  process.exit(1);
}

const client = new S3Client({
  region: "auto",
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

async function main() {
  if (process.argv.includes("--get")) {
    const res = await client.send(new GetBucketCorsCommand({ Bucket: BUCKET }));
    console.log(JSON.stringify(res.CORSRules, null, 2));
    return;
  }

  const origins = Array.from(new Set(ALLOWED_ORIGINS));
  console.log(`Applying CORS to bucket "${BUCKET}" for origins:`);
  origins.forEach((o) => console.log(`  - ${o}`));

  await client.send(
    new PutBucketCorsCommand({
      Bucket: BUCKET,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: origins,
            AllowedMethods: ["PUT", "GET", "HEAD"],
            AllowedHeaders: ["*"],
            ExposeHeaders: ["ETag"],
            MaxAgeSeconds: 3000,
          },
        ],
      },
    }),
  );

  console.log("\nCORS applied. Re-run with --get to verify.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
