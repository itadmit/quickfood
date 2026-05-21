/**
 * QStash (Upstash) client — publishes delayed jobs and verifies inbound
 * webhook signatures.
 *
 * We use QStash for one-shot delayed jobs (e.g. "send review reminder for
 * order X in 60 minutes"). The receiving handler must call `verifySignature`
 * on the request before doing work.
 */
import crypto from "node:crypto";

const QSTASH_URL = process.env.QSTASH_URL?.replace(/\/$/, "") ?? "";
const QSTASH_TOKEN = process.env.QSTASH_TOKEN ?? "";
const CURRENT_KEY = process.env.QSTASH_CURRENT_SIGNING_KEY ?? "";
const NEXT_KEY = process.env.QSTASH_NEXT_SIGNING_KEY ?? "";

export class QStashError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly raw?: unknown,
  ) {
    super(message);
    this.name = "QStashError";
  }
}

export interface PublishInput<T> {
  /** Absolute URL of the receiver. */
  url: string;
  body: T;
  /** Delay before delivery. Accepts seconds (number) or duration string ("60m"). */
  delay?: number | string;
  /** Idempotency / dedupe key. QStash will dedupe identical IDs within retention. */
  deduplicationId?: string;
  /** Additional headers to forward to the receiver. */
  headers?: Record<string, string>;
}

export interface ScheduleInput {
  /** Absolute URL of the receiver. */
  url: string;
  /** Cron expression in QStash's accepted dialect (e.g. "* * * * *"). */
  cron: string;
  /** Stable scheduleId — QStash upserts when this is provided. */
  scheduleId?: string;
  /** Optional body; QStash forwards this on every fire. Defaults to "{}". */
  body?: unknown;
  /** Method QStash should use when calling the URL. Defaults to POST. */
  method?: "GET" | "POST";
  /** Extra headers forwarded to the receiver. */
  forwardHeaders?: Record<string, string>;
}

export interface ScheduleListEntry {
  scheduleId: string;
  destination: string;
  cron: string;
  createdAt: number;
}

/**
 * Upsert a recurring QStash schedule. If `scheduleId` is provided, QStash
 * replaces any existing schedule with that id. Otherwise it creates a fresh
 * one and returns the generated id.
 */
export async function upsertSchedule(input: ScheduleInput): Promise<{ scheduleId: string }> {
  if (!QSTASH_URL || !QSTASH_TOKEN) {
    throw new QStashError("QSTASH_URL / QSTASH_TOKEN missing", 503);
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${QSTASH_TOKEN}`,
    "content-type": "application/json",
    "Upstash-Cron": input.cron,
    "Upstash-Method": input.method ?? "POST",
  };
  if (input.scheduleId) {
    headers["Upstash-Schedule-Id"] = input.scheduleId;
  }
  for (const [k, v] of Object.entries(input.forwardHeaders ?? {})) {
    // QStash forwards anything prefixed with Upstash-Forward- to the destination.
    headers[`Upstash-Forward-${k}`] = v;
  }

  // QStash wants the destination URL appended raw (not URL-encoded). The path
  // is parsed by them as `…/v2/schedules/<full-url>` where `<full-url>` keeps
  // its `https://` scheme intact.
  const target = `${QSTASH_URL}/v2/schedules/${input.url}`;
  const res = await fetch(target, {
    method: "POST",
    headers,
    body: JSON.stringify(input.body ?? {}),
    cache: "no-store",
  });
  const text = await res.text();
  const parsed = text ? safeJson(text) : null;
  if (!res.ok) {
    throw new QStashError(
      `QStash schedule failed: ${res.status} ${text}`,
      res.status,
      parsed,
    );
  }
  const scheduleId = (parsed as { scheduleId?: string } | null)?.scheduleId ?? input.scheduleId ?? "";
  return { scheduleId };
}

/** List all currently-registered QStash schedules on this account. */
export async function listSchedules(): Promise<ScheduleListEntry[]> {
  if (!QSTASH_URL || !QSTASH_TOKEN) {
    throw new QStashError("QSTASH_URL / QSTASH_TOKEN missing", 503);
  }
  const res = await fetch(`${QSTASH_URL}/v2/schedules`, {
    headers: { Authorization: `Bearer ${QSTASH_TOKEN}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new QStashError(`QStash list failed: ${res.status}`, res.status);
  }
  const data = (await res.json().catch(() => [])) as ScheduleListEntry[];
  return Array.isArray(data) ? data : [];
}

/** Delete a schedule by id. */
export async function deleteSchedule(scheduleId: string): Promise<void> {
  if (!QSTASH_URL || !QSTASH_TOKEN) {
    throw new QStashError("QSTASH_URL / QSTASH_TOKEN missing", 503);
  }
  const res = await fetch(`${QSTASH_URL}/v2/schedules/${encodeURIComponent(scheduleId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${QSTASH_TOKEN}` },
  });
  if (!res.ok && res.status !== 404) {
    throw new QStashError(`QStash delete failed: ${res.status}`, res.status);
  }
}

export async function publish<T>(input: PublishInput<T>): Promise<{ messageId: string }> {
  if (!QSTASH_URL || !QSTASH_TOKEN) {
    throw new QStashError("QSTASH_URL / QSTASH_TOKEN missing", 503);
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${QSTASH_TOKEN}`,
    "content-type": "application/json",
    ...(input.headers ?? {}),
  };

  if (input.delay !== undefined) {
    headers["Upstash-Delay"] =
      typeof input.delay === "number" ? `${input.delay}s` : input.delay;
  }
  if (input.deduplicationId) {
    headers["Upstash-Deduplication-Id"] = input.deduplicationId;
  }

  // QStash publish URL: POST {qstash}/v2/publish/{destination}.
  // Destination is appended raw — QStash parses everything after /v2/publish/
  // as the target URL including its `https://` scheme.
  const target = `${QSTASH_URL}/v2/publish/${input.url}`;
  const res = await fetch(target, {
    method: "POST",
    headers,
    body: JSON.stringify(input.body),
    cache: "no-store",
  });

  const text = await res.text();
  const parsed = text ? safeJson(text) : null;
  if (!res.ok) {
    throw new QStashError(
      `QStash publish failed: ${res.status} ${text}`,
      res.status,
      parsed,
    );
  }

  const messageId = (parsed as { messageId?: string } | null)?.messageId ?? "";
  return { messageId };
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

/**
 * Verify the `upstash-signature` header on an inbound QStash request.
 *
 * QStash uses JWT in the form of `header.payload.signature` (HMAC-SHA256).
 * The payload contains `iss`, `sub` (target URL), `exp`, `nbf`, `iat`, and
 * `body` (SHA-256 hash of the request body, base64url).
 *
 * Accepts either the current OR next signing key — QStash rotates them.
 */
export async function verifySignature(req: Request, rawBody: string): Promise<boolean> {
  const sig = req.headers.get("upstash-signature");
  if (!sig) return false;

  const parts = sig.split(".");
  if (parts.length !== 3) return false;
  const [encodedHeader, encodedPayload, encodedSig] = parts;

  // Try both keys.
  for (const key of [CURRENT_KEY, NEXT_KEY].filter(Boolean)) {
    const expected = crypto
      .createHmac("sha256", key)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest("base64url");
    if (encodedSig === expected) {
      // Validate body hash matches what we got.
      const payload = decodePayload(encodedPayload);
      if (!payload) return false;
      const expectedBodyHash = crypto
        .createHash("sha256")
        .update(rawBody)
        .digest("base64url");
      if (payload.body !== expectedBodyHash) return false;
      // Validate exp/nbf.
      const now = Math.floor(Date.now() / 1000);
      if (typeof payload.exp === "number" && now > payload.exp) return false;
      if (typeof payload.nbf === "number" && now < payload.nbf - 5) return false;
      return true;
    }
  }
  return false;
}

function decodePayload(encoded: string): {
  body?: string;
  exp?: number;
  nbf?: number;
  sub?: string;
} | null {
  try {
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch {
    return null;
  }
}
