import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

export interface MintedKey {
  prefix: string;
  secret: string;
  hash: string;
  full: string;
}

export async function mintApiKey(): Promise<MintedKey> {
  const prefix = randomBytes(6).toString("hex");
  const secret = randomBytes(24).toString("hex");
  const hash = await bcrypt.hash(secret, 10);
  return {
    prefix,
    secret,
    hash,
    full: `qfk_${prefix}_${secret}`,
  };
}
