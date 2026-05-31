/**
 * Vercel Domains API — thin client for the per-tenant custom-domain flow.
 *
 * Shopify-style flow:
 *   1. Merchant types a domain → `addDomain` → Vercel returns either
 *      `verified=true` (no TXT needed) or a `verification[]` challenge.
 *   2. We also call `getDomainConfig` to learn (a) whether DNS is correctly
 *      pointing at Vercel and (b) the recommended A / CNAME records to
 *      show in the UI.
 *   3. When the merchant clicks "Verify" we call `verifyDomain` (only when
 *      a TXT challenge is pending) and `getDomainConfig` again — once both
 *      `verified=true` and `misconfigured=false` we flip the tenant to
 *      `customDomainStatus = 'active'`.
 *   4. SSL is provisioned automatically by Vercel once the domain is
 *      verified and resolves to their infrastructure.
 *
 * Auth: bearer token (`VERCEL_TOKEN`) + `teamId` query param when the
 * project lives under a team account (which ours does — see
 * `.vercel/project.json`).
 */

export type VercelVerification = {
  type: string;
  domain: string;
  value: string;
  reason: string;
};

export type VercelAddDomainResponse = {
  name: string;
  apexName: string;
  projectId: string;
  verified: boolean;
  verification?: VercelVerification[];
  updatedAt?: number;
  createdAt?: number;
};

export type VercelDomainConfig = {
  configuredBy: "A" | "CNAME" | "http" | "dns-01" | null;
  acceptedChallenges: ("dns-01" | "http-01")[];
  misconfigured: boolean;
  recommendedIPv4: Array<{ rank: number; value: string[] }>;
  recommendedCNAME: Array<{ rank: number; value: string }>;
};

export class VercelApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "VercelApiError";
    this.status = status;
    this.code = code;
  }
}

export class VercelNotConfiguredError extends Error {
  constructor() {
    super("VERCEL_TOKEN missing");
    this.name = "VercelNotConfiguredError";
  }
}

export function isVercelConfigured(): boolean {
  return Boolean(process.env.VERCEL_TOKEN);
}

// Fallbacks resolved from `.vercel/project.json` at the time this file was
// authored. Env vars (VERCEL_PROJECT_ID, VERCEL_TEAM_ID) override.
const DEFAULT_PROJECT_ID = "prj_gyjQFTiFdDKDVgVnd0K8w35rgCZF";
const DEFAULT_TEAM_ID = "team_aQxkS9C7296KcXuBKsKmS30W";

function readEnv(): { token: string; projectId: string; teamId?: string } {
  const token = process.env.VERCEL_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID || DEFAULT_PROJECT_ID;
  const teamId = process.env.VERCEL_TEAM_ID || DEFAULT_TEAM_ID;
  if (!token) throw new VercelNotConfiguredError();
  return { token, projectId, teamId };
}

function buildUrl(path: string, query?: Record<string, string | undefined>): string {
  const { teamId } = readEnv();
  const url = new URL(`https://api.vercel.com${path}`);
  if (teamId) url.searchParams.set("teamId", teamId);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) url.searchParams.set(k, v);
    }
  }
  return url.toString();
}

async function vercelFetch<T>(
  path: string,
  init: RequestInit = {},
  query?: Record<string, string | undefined>,
): Promise<T> {
  const { token } = readEnv();
  const url = buildUrl(path, query);
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    let body: { error?: { code?: string; message?: string } } | null = null;
    try {
      body = (await res.json()) as { error?: { code?: string; message?: string } };
    } catch {
      // not json
    }
    const msg = body?.error?.message || `Vercel API ${res.status}`;
    throw new VercelApiError(msg, res.status, body?.error?.code);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function addDomain(name: string): Promise<VercelAddDomainResponse> {
  const { projectId } = readEnv();
  return vercelFetch<VercelAddDomainResponse>(
    `/v10/projects/${projectId}/domains`,
    {
      method: "POST",
      body: JSON.stringify({ name }),
    },
  );
}

export async function verifyDomain(name: string): Promise<VercelAddDomainResponse> {
  const { projectId } = readEnv();
  return vercelFetch<VercelAddDomainResponse>(
    `/v9/projects/${projectId}/domains/${encodeURIComponent(name)}/verify`,
    { method: "POST" },
  );
}

export async function getDomainConfig(name: string): Promise<VercelDomainConfig> {
  const { projectId } = readEnv();
  return vercelFetch<VercelDomainConfig>(
    `/v6/domains/${encodeURIComponent(name)}/config`,
    { method: "GET" },
    { projectIdOrName: projectId },
  );
}

export async function removeDomain(name: string): Promise<void> {
  const { projectId } = readEnv();
  await vercelFetch<unknown>(
    `/v9/projects/${projectId}/domains/${encodeURIComponent(name)}`,
    { method: "DELETE" },
  );
}

/**
 * Normalize merchant input: strip protocol, path, "www.", lowercase,
 * trim. Returns null if it doesn't look like a valid hostname.
 */
export function normalizeHostname(input: string): string | null {
  let s = input.trim().toLowerCase();
  if (!s) return null;
  // Strip protocol
  s = s.replace(/^https?:\/\//, "");
  // Strip path / query / hash
  s = s.split("/")[0]!.split("?")[0]!.split("#")[0]!;
  // Strip port
  s = s.split(":")[0]!;
  // Strip trailing dot
  s = s.replace(/\.+$/, "");
  if (!s) return null;
  // Hostname regex — labels of 1-63 [a-z0-9-] separated by dots, TLD min 2.
  // Allows IDN punycode (xn--...).
  const re = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
  if (!re.test(s)) return null;
  return s;
}
