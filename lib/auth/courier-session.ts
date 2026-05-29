import { cookies, headers } from "next/headers";
import crypto from "node:crypto";
import { prisma } from "@/lib/db/client";
import { apiError } from "@/lib/api-response";

export const COURIER_COOKIE = "qf_courier";
const SESSION_TTL_DAYS = 30;
const isProd = process.env.NODE_ENV === "production";

export interface CourierSession {
  type: "courier";
  courierId: string;
  tenantId: string;
  branchId: string | null;
  name: string;
  sessionId: string;
}

export function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function generateRawToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export async function issueCourierSession(courierId: string): Promise<string> {
  const raw = generateRawToken();
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  const hdrs = await headers();
  const device = hdrs.get("user-agent")?.slice(0, 200) ?? null;
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    hdrs.get("x-real-ip") ||
    null;

  await prisma.courierSession.create({
    data: { courierId, tokenHash, device, ip, expiresAt },
  });
  return raw;
}

export async function setCourierCookie(raw: string): Promise<void> {
  const jar = await cookies();
  jar.set(COURIER_COOKIE, raw, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  });
}

export async function clearCourierCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(COURIER_COOKIE);
}

export async function getCourierSession(): Promise<CourierSession | null> {
  const jar = await cookies();
  const raw = jar.get(COURIER_COOKIE)?.value;
  if (!raw) return null;

  const tokenHash = hashToken(raw);
  const session = await prisma.courierSession.findUnique({
    where: { tokenHash },
    include: {
      courier: {
        select: {
          id: true,
          tenantId: true,
          branchId: true,
          name: true,
          active: true,
        },
      },
    },
  });
  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt < new Date()) return null;
  if (!session.courier.active) return null;

  return {
    type: "courier",
    courierId: session.courier.id,
    tenantId: session.courier.tenantId,
    branchId: session.courier.branchId,
    name: session.courier.name,
    sessionId: session.id,
  };
}

export async function requireCourier(): Promise<CourierSession> {
  const s = await getCourierSession();
  if (!s) throw apiError("unauthorized", "נדרשת התחברות שליח", 401);
  return s;
}

export async function revokeCourierSession(sessionId: string): Promise<void> {
  await prisma.courierSession.update({
    where: { id: sessionId },
    data: { revokedAt: new Date() },
  });
}
