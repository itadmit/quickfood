/**
 * Unified API error/success response helpers.
 * Per /Users/tadmitinteractive/Downloads/pizza/API.md §7 — { error: { code, message, field? } }.
 */

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    field?: string;
  };
}

export function apiError(code: string, message: string, status = 400, field?: string): Response {
  // Defense in depth: callers occasionally forward `message` straight from
  // upstream providers (e.g. Grow's `{id, message}` validation wrappers).
  // Coerce here so the body's `error.message` is always a string — otherwise
  // clients that render `data.error.message` directly hit React #31.
  const safeMessage =
    typeof message === "string"
      ? message
      : message == null
        ? "שגיאה"
        : (() => {
            try {
              return JSON.stringify(message);
            } catch {
              return String(message);
            }
          })();
  const body: ApiErrorBody = {
    error: { code, message: safeMessage, ...(field ? { field } : {}) },
  };
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export function apiJson<T>(data: T, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}

export function apiEmpty(status = 204): Response {
  return new Response(null, { status });
}

/**
 * Wrap an async API handler so that thrown Responses bubble correctly,
 * and ZodErrors / other failures map to validation_error / internal_error.
 */
export function handler<Args extends unknown[]>(
  fn: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof Response) return err;
      // ZodError shape
      const e = err as { name?: string; issues?: Array<{ path: (string | number)[]; message: string }>; message?: string };
      if (e?.name === "ZodError" && Array.isArray(e.issues)) {
        const first = e.issues[0];
        return apiError(
          "validation_error",
          first?.message ?? "validation failed",
          422,
          first?.path.join(".") || undefined,
        );
      }
      console.error("[api] unhandled error", err);
      return apiError("internal_error", "שגיאת שרת", 500);
    }
  };
}
