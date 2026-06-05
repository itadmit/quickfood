import {
  S3Client,
  HeadObjectCommand,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NodeHttpHandler } from "@smithy/node-http-handler";

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
    // Fail fast - without these, a misconfigured endpoint or a flaky
    // R2 connection can hang the SDK for several minutes and burn the
    // whole Vercel function budget (Task timed out after 300 seconds).
    maxAttempts: 2,
    requestHandler: new NodeHttpHandler({
      connectionTimeout: 3_000,
      requestTimeout: 10_000,
    }),
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

/**
 * Delete every object under `prefix`. Used when a tenant resets or
 * deletes their store so we don't leave orphan images in the bucket.
 *
 * Paginates ListObjectsV2 (1k keys per page) and batches DeleteObjects
 * (1k keys per request - the S3 hard limit). Returns the total count
 * deleted so callers can include it in their summary.
 *
 * Best-effort: any single batch failure is swallowed (and counted as
 * skipped) so partial progress isn't lost. The DB row reset that
 * preceded this call has already succeeded by the time we touch R2.
 */
export async function deletePrefix(
  prefix: string,
): Promise<{ deleted: number; errors: number }> {
  const s3 = client();
  let deleted = 0;
  let errors = 0;
  let continuationToken: string | undefined;

  do {
    const page = await s3.send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: prefix,
        ContinuationToken: continuationToken,
        // 1000 is both the S3 list cap AND the DeleteObjects cap - one
        // page maps cleanly to one delete request.
        MaxKeys: 1000,
      }),
    );

    const keys = (page.Contents ?? [])
      .map((o) => o.Key)
      .filter((k): k is string => !!k);

    if (keys.length) {
      try {
        const res = await s3.send(
          new DeleteObjectsCommand({
            Bucket: BUCKET,
            Delete: {
              Objects: keys.map((Key) => ({ Key })),
              Quiet: true,
            },
          }),
        );
        deleted += keys.length - (res.Errors?.length ?? 0);
        errors += res.Errors?.length ?? 0;
      } catch {
        errors += keys.length;
      }
    }

    continuationToken = page.IsTruncated
      ? page.NextContinuationToken
      : undefined;
  } while (continuationToken);

  return { deleted, errors };
}
