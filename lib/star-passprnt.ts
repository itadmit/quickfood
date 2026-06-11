const PASSPRNT_SCHEME = "starpassprnt://v1/print/nopreview";
const RECEIPT_WIDTH_DOTS = 576;

export function openPassPrnt(html: string): void {
  const back = `${window.location.origin}${window.location.pathname}`;
  const url =
    `${PASSPRNT_SCHEME}?back=${encodeURIComponent(back)}` +
    `&size=${RECEIPT_WIDTH_DOTS}` +
    `&html=${encodeURIComponent(html)}`;
  window.location.href = url;
}

export function consumePassPrntResult(): { ok: boolean; message: string } | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const code = params.get("passprnt_code");
  if (code === null) return null;
  const message = params.get("passprnt_message") ?? "";

  params.delete("passprnt_code");
  params.delete("passprnt_message");
  const rest = params.toString();
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${rest ? `?${rest}` : ""}${window.location.hash}`,
  );

  return { ok: code === "0", message };
}
