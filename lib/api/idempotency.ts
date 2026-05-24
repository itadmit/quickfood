import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { prisma } from "@/lib/db/client";
import { apiError } from "@/lib/api-response";

const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_KEY_LEN = 200;

export interface IdempotencyHit {
  status: number;
  body: string;
}

export interface IdempotencyContext {
  key: string;
  requestHash: string;
}

/**
 * Read the Idempotency-Key header and look for a prior matching record.
 * - No header → returns `null` (caller proceeds without dedup).
 * - Cached match → returns `{ hit }` (caller replays the response).
 * - Cached with different body → throws 409 conflict.
 * - No cached record → returns `{ context }` (caller runs the work, then calls
 *   `persistIdempotency` with the response).
 */
export async function checkIdempotency(
  tenantId: string,
  method: string,
  path: string,
  rawBody: string,
): Promise<{ hit: IdempotencyHit } | { context: IdempotencyContext } | null> {
  const hdrs = await headers();
  const key = hdrs.get("idempotency-key");
  if (!key) return null;
  if (key.length > MAX_KEY_LEN) {
    throw apiError(
      "validation_error",
      `Idempotency-Key חורג מ-${MAX_KEY_LEN} תווים`,
      422,
      "Idempotency-Key",
    );
  }

  const requestHash = createHash("sha256")
    .update(`${method}\n${path}\n${rawBody}`)
    .digest("hex");

  const existing = await prisma.idempotencyRecord.findUnique({
    where: { tenantId_key: { tenantId, key } },
  });

  if (existing) {
    if (existing.expiresAt < new Date()) {
      await prisma.idempotencyRecord.delete({ where: { id: existing.id } }).catch(() => {});
    } else {
      if (existing.requestHash !== requestHash) {
        throw apiError(
          "conflict",
          "Idempotency-Key כבר נוצל עם בקשה שונה",
          409,
          "Idempotency-Key",
        );
      }
      return { hit: { status: existing.statusCode, body: existing.responseBody } };
    }
  }

  return { context: { key, requestHash } };
}

export async function persistIdempotency(
  tenantId: string,
  method: string,
  path: string,
  ctx: IdempotencyContext,
  res: Response,
): Promise<Response> {
  if (res.status >= 500) return res;
  const body = await res.clone().text();
  await prisma.idempotencyRecord
    .create({
      data: {
        tenantId,
        key: ctx.key,
        method,
        path,
        requestHash: ctx.requestHash,
        statusCode: res.status,
        responseBody: body,
        expiresAt: new Date(Date.now() + TTL_MS),
      },
    })
    .catch(() => {
      // Race condition: another request stored the same key between check and persist.
      // The other one wins; we still return the live response.
    });
  return res;
}

export function replayHit(hit: IdempotencyHit): Response {
  return new Response(hit.body, {
    status: hit.status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "x-quickfood-idempotent-replay": "true",
    },
  });
}
