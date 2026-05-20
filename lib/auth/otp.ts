import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/client";

const OTP_LENGTH = 6;
const OTP_TTL_MIN = 10;
const MAX_ATTEMPTS = 5;

export function generateCode(): string {
  return Array.from({ length: OTP_LENGTH }, () => Math.floor(Math.random() * 10)).join("");
}

export async function issueOtp(phone: string): Promise<{ code: string; expiresAt: Date }> {
  const code = generateCode();
  const codeHash = await bcrypt.hash(code, 8);
  const expiresAt = new Date(Date.now() + OTP_TTL_MIN * 60_000);

  await prisma.otpCode.create({
    data: { phone, codeHash, expiresAt },
  });

  return { code, expiresAt };
}

export async function verifyOtp(phone: string, code: string): Promise<boolean> {
  const record = await prisma.otpCode.findFirst({
    where: { phone, usedAt: null, expiresAt: { gt: new Date() } },
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
