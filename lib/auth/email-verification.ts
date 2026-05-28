import crypto from "node:crypto";
import { prisma } from "@/lib/db/client";
import { sendEmail } from "@/lib/email/send";
import { verifyEmailEmail } from "@/lib/email/templates";

export const VERIFICATION_EXPIRY_HOURS = 24;

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function randomToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://quickfood.co.il").replace(/\/$/, "");
}

export async function createVerificationToken(userId: string): Promise<string> {
  const raw = randomToken();
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + VERIFICATION_EXPIRY_HOURS * 60 * 60 * 1000);

  await prisma.emailVerificationToken.create({
    data: { userId, tokenHash, expiresAt },
  });

  return raw;
}

export async function consumeVerificationToken(
  raw: string,
): Promise<{ ok: true; userId: string } | { ok: false; reason: "not_found" | "expired" | "used" }> {
  const tokenHash = hashToken(raw);
  const row = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, emailVerifiedAt: true } } },
  });
  if (!row) return { ok: false, reason: "not_found" };
  if (row.usedAt) {
    if (row.user.emailVerifiedAt) return { ok: true, userId: row.userId };
    return { ok: false, reason: "used" };
  }
  if (row.expiresAt.getTime() < Date.now()) return { ok: false, reason: "expired" };

  await prisma.$transaction([
    prisma.emailVerificationToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    }),
    prisma.merchantUser.update({
      where: { id: row.userId },
      data: { emailVerifiedAt: row.user.emailVerifiedAt ?? new Date() },
    }),
  ]);

  return { ok: true, userId: row.userId };
}

export async function sendVerificationEmail({
  userId,
  email,
  ownerName,
  businessName,
  tenantId,
}: {
  userId: string;
  email: string;
  ownerName: string;
  businessName: string;
  tenantId: string | null;
}): Promise<void> {
  const raw = await createVerificationToken(userId);
  const verifyUrl = `${appBaseUrl()}/api/v1/auth/verify-email/${raw}`;
  const { html, text } = verifyEmailEmail({
    ownerName,
    businessName,
    verifyUrl,
    expiresInHours: VERIFICATION_EXPIRY_HOURS,
  });
  await sendEmail({
    tenantId,
    to: email,
    subject: `הפעלת החנות ${businessName} ב-QuickFood`,
    body: text,
    html,
    kind: "email_verification",
    refKind: "merchant_user",
    refId: userId,
  });
}

const RESEND_LIMIT = 5;
const RESEND_WINDOW_MIN = 60;

export async function canResendVerification(userId: string): Promise<boolean> {
  const since = new Date(Date.now() - RESEND_WINDOW_MIN * 60 * 1000);
  const count = await prisma.emailVerificationToken.count({
    where: { userId, createdAt: { gt: since } },
  });
  return count < RESEND_LIMIT;
}
