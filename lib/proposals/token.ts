import { randomInt } from "node:crypto";
import { prisma } from "@/lib/db/client";

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

function randomToken(len = 5): string {
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

/** Generate a 5-char slug that is not already taken in `proposals`. */
export async function uniqueProposalToken(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const token = randomToken();
    const existing = await prisma.proposal.findUnique({ where: { token }, select: { id: true } });
    if (!existing) return token;
  }
  return randomToken(7);
}
