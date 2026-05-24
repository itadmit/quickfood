import { S3Client, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID || "";
const BUCKET = process.env.R2_BUCKET || "quickfood-uploads";
const PUBLIC_URL = process.env.R2_PUBLIC_URL || "";

function client() {
  if (!ACCOUNT_ID) throw new Error("R2_ACCOUNT_ID not configured");
  return new S3Client({
    region: "auto",
    endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
    },
  });
}

export function publicUrlFor(key: string): string {
  if (!PUBLIC_URL) return `https://${ACCOUNT_ID}.r2.cloudflarestorage.com/${BUCKET}/${key}`;
  return `${PUBLIC_URL.replace(/\/$/, "")}/${key}`;
}

export async function createUploadUrl(opts: {
  key: string;
  contentType: string;
  contentLength?: number;
  expiresInSec?: number;
}): Promise<{ url: string; method: "PUT"; headers: Record<string, string> }> {
  const cmd = new PutObjectCommand({
    Bucket: BUCKET,
    Key: opts.key,
    ContentType: opts.contentType,
    ContentLength: opts.contentLength,
  });
  const url = await getSignedUrl(client(), cmd, {
    expiresIn: opts.expiresInSec ?? 600,
  });
  return {
    url,
    method: "PUT",
    headers: { "content-type": opts.contentType },
  };
}

export async function objectExists(key: string): Promise<boolean> {
  try {
    await client().send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Upload a Buffer/Uint8Array directly from the server. Used by importers
 * that already have the bytes in memory (e.g. fetched a Wolt CDN image),
 * so a client-side presigned PUT would be wasted hops.
 *
 * Returns the public URL via {@link publicUrlFor}.
 */
export async function uploadBytes(opts: {
  key: string;
  body: Uint8Array | Buffer;
  contentType: string;
  cacheControl?: string;
}): Promise<string> {
  await client().send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: opts.key,
      Body: opts.body,
      ContentType: opts.contentType,
      CacheControl: opts.cacheControl ?? "public, max-age=31536000, immutable",
    }),
  );
  return publicUrlFor(opts.key);
}
