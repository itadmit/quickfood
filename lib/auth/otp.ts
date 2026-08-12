import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/client";

const OTP_LENGTH = 6;
const OTP_TTL_MIN = 10;
const MAX_ATTEMPTS = 5;

type OtpTarget = { phone: string; email?: never } | { email: string; phone?: never };

export function generateCode(): string {
  return Array.from({ length: OTP_LENGTH }, () => Math.floor(Math.random() * 10)).join("");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function issue(target: OtpTarget): Promise<{ code: string; expiresAt: Date }> {
  const code = generateCode();
  const codeHash = await bcrypt.hash(code, 8);
  const expiresAt = new Date(Date.now() + OTP_TTL_MIN * 60_000);

  await prisma.otpCode.create({
    data: {
      phone: target.phone ?? null,
      email: target.email ?? null,
      codeHash,
      expiresAt,
    },
  });

  return { code, expiresAt };
}

async function verify(target: OtpTarget, code: string): Promise<boolean> {
  const record = await prisma.otpCode.findFirst({
    where: {
      phone: target.phone ?? null,
      email: target.email ?? null,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!record) return false;
  if (record.attempts >= MAX_ATTEMPTS) return false;

  const ok = await bcrypt.compare(code, record.codeHash);

  if (!ok) {
    await prisma.otpCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    return false;
  }

  await prisma.otpCode.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });
  return true;
}

export async function issueOtp(phone: string): Promise<{ code: string; expiresAt: Date }> {
  return issue({ phone });
}

export async function verifyOtp(phone: string, code: string): Promise<boolean> {
  return verify({ phone }, code);
}

export async function issueEmailOtp(email: string): Promise<{ code: string; expiresAt: Date }> {
  return issue({ email: normalizeEmail(email) });
}

export async function verifyEmailOtp(email: string, code: string): Promise<boolean> {
  return verify({ email: normalizeEmail(email) }, code);
}
