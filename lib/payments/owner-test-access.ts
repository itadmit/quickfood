import { getSession } from "@/lib/auth/session";

const OWNER_TEST_ROLES = new Set(["owner", "manager", "platform_admin"]);

export async function canUseOwnerTestCard(tenantId: string): Promise<boolean> {
  const session = await getSession();
  if (!session || session.type !== "merchant" || session.via === "api_key") return false;
  if (!OWNER_TEST_ROLES.has(session.role ?? "")) return false;
  return session.role === "platform_admin" || session.tenantId === tenantId;
}

export const OWNER_TEST_ORDER_NOTE = "הזמנת בדיקה - תשלום במסוף בדיקות, לא נגבה כסף אמיתי";
export const OWNER_TEST_ORDER_EVENT = "owner_test_payment";
