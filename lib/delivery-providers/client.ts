export async function requestProviderDispatch(
  orderId: string,
  providerId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const res = await fetch(`/api/v1/merchant/orders/${orderId}/delivery-provider`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider: providerId }),
    });
    if (res.ok) return { ok: true };
    const body = await res.json().catch(() => ({}));
    return { ok: false, message: body?.error?.message ?? "השליחה לחברת המשלוחים נכשלה" };
  } catch {
    return { ok: false, message: "אין חיבור לשרת" };
  }
}
