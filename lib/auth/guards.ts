import { getSession, type Session } from "./session";
import { apiError } from "@/lib/api-response";

/**
 * Guards — call from API Route Handlers. Throw a Response on failure.
 * Usage:
 *   const session = await requireCustomer();
 *   // ... use session.userId
 */

export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) throw apiError("unauthorized", "נדרשת התחברות", 401);
  return s;
}

export async function requireCustomer(): Promise<Session> {
  const s = await requireSession();
  if (s.type !== "customer") {
    throw apiError("forbidden", "נדרש משתמש לקוח", 403);
  }
  return s;
}

export async function requireMerchant(roles?: string[]): Promise<Session> {
  const s = await requireSession();
  if (s.type !== "merchant") {
    throw apiError("forbidden", "נדרש משתמש מסעדה", 403);
  }
  if (roles && roles.length > 0 && !roles.includes(s.role ?? "")) {
    throw apiError("forbidden", "אין הרשאה לפעולה זו", 403);
  }
  return s;
}

export async function requireAdmin(): Promise<Session> {
  const s = await requireSession();
  if (s.type !== "merchant" || s.role !== "platform_admin") {
    throw apiError("forbidden", "נדרש מנהל פלטפורמה", 403);
  }
  return s;
}

export async function requireTenant(tenantId: string): Promise<Session> {
  const s = await requireMerchant();
  if (s.role !== "platform_admin" && s.tenantId !== tenantId) {
    throw apiError("forbidden", "tenant mismatch", 403);
  }
  return s;
}
