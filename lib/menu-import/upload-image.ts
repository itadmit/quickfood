"use client";

import { convertImageToWebP } from "@/lib/image/convert-to-webp";

interface UploadInit {
  file_id: string;
  key: string;
  upload: { url: string; method: "PUT"; headers: Record<string, string> };
}

// Uploads a single dish photo (camera capture or gallery pick) to R2 via the
// standard init -> PUT -> finalize flow and returns the public URL. Mirrors
// ImageUploader, minus the progress UI. Re-encodes to WebP first.
export async function uploadMenuItemImage(original: File): Promise<string> {
  const file = await convertImageToWebP(original);

  const initRes = await fetch("/api/v1/upload/init", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      type: "menu_item_image",
      filename: file.name,
      mime_type: file.type,
      size_bytes: file.size,
    }),
  });
  if (!initRes.ok) throw new Error("init failed");
  const init = (await initRes.json()) as UploadInit;

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(init.upload.method, init.upload.url, true);
    for (const [k, v] of Object.entries(init.upload.headers)) xhr.setRequestHeader(k, v);
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`R2 status ${xhr.status}`));
    xhr.onerror = () => reject(new Error("R2 network error"));
    xhr.send(file);
  });

  const finRes = await fetch(
    `/api/v1/upload/finalize/${init.file_id}?key=${encodeURIComponent(init.key)}`,
    { method: "POST" },
  );
  if (!finRes.ok) throw new Error("finalize failed");
  const { url } = (await finRes.json()) as { url: string };
  return url;
}
