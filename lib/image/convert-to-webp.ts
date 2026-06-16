const DEFAULT_QUALITY = 0.85;
const DEFAULT_MAX_DIMENSION = 2000;
const DEFAULT_TARGET_BYTES = 1024 * 1024; // ~1MB - keep stored images light
const DEFAULT_MIN_DIMENSION = 1280; // floor: stop shrinking here even if still over target

export interface ConvertOptions {
  quality?: number;
  maxDimension?: number;
  /** Hard byte budget. The image is shrunk (dimensions only) until it fits.
   *  0 disables the budget loop (single-pass resize only). */
  targetBytes?: number;
  /** Longest side never shrinks below this in pursuit of targetBytes. */
  minDimension?: number;
}

/**
 * Convert a user-picked image File to WebP entirely in the browser before
 * upload - so R2 only ever stores light WebP and the server never re-encodes.
 * Downscales to maxDimension on the longest side (no upscaling), then keeps
 * quality FIXED and shrinks dimensions ~15% at a time until the file fits under
 * targetBytes (floored at minDimension). Returns the original File on any
 * failure so callers never have to branch.
 */
export async function convertImageToWebP(
  file: File,
  opts: ConvertOptions = {},
): Promise<File> {
  if (typeof document === "undefined") return file;
  if (!file.type.startsWith("image/")) return file;
  // SVG (needs server sanitize) and GIF (animation) can't be canvas-encoded.
  if (file.type === "image/svg+xml" || file.type === "image/gif") return file;

  const quality = opts.quality ?? DEFAULT_QUALITY;
  const maxDim = opts.maxDimension ?? DEFAULT_MAX_DIMENSION;
  const targetBytes = opts.targetBytes ?? DEFAULT_TARGET_BYTES;
  const minDim = opts.minDimension ?? DEFAULT_MIN_DIMENSION;

  try {
    const bitmap = await createImageBitmap(file);

    // Already a small-enough webp within the dimension cap - keep the bytes.
    if (
      file.type === "image/webp" &&
      (targetBytes <= 0 || file.size <= targetBytes) &&
      (maxDim <= 0 || Math.max(bitmap.width, bitmap.height) <= maxDim)
    ) {
      bitmap.close();
      return file;
    }

    let width = bitmap.width;
    let height = bitmap.height;
    if (maxDim > 0 && Math.max(width, height) > maxDim) {
      const scale = maxDim / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    const encode = (w: number, h: number): Promise<Blob | null> => {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return Promise.resolve(null);
      ctx.drawImage(bitmap, 0, 0, w, h);
      return new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality));
    };

    let blob = await encode(width, height);
    // Shrink dimensions (not quality) until under the byte budget or at the floor.
    while (
      blob &&
      targetBytes > 0 &&
      blob.size > targetBytes &&
      Math.max(width, height) > minDim
    ) {
      width = Math.round(width * 0.85);
      height = Math.round(height * 0.85);
      const next = await encode(width, height);
      if (!next) break;
      blob = next;
    }
    bitmap.close();
    if (!blob) return file;

    const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
    return new File([blob], `${baseName}.webp`, {
      type: "image/webp",
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}
