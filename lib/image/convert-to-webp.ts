const DEFAULT_QUALITY = 0.85;
const DEFAULT_MAX_DIMENSION = 2000;

export interface ConvertOptions {
  quality?: number;
  maxDimension?: number;
}

/**
 * Convert a user-picked image File to WebP in the browser before upload.
 * Downscales to maxDimension on the longest side (no upscaling) and encodes
 * at the given quality. Returns the original File on any failure so the
 * caller never has to branch.
 */
export async function convertImageToWebP(
  file: File,
  opts: ConvertOptions = {},
): Promise<File> {
  if (typeof document === "undefined") return file;
  if (!file.type.startsWith("image/")) return file;

  const quality = opts.quality ?? DEFAULT_QUALITY;
  const maxDim = opts.maxDimension ?? DEFAULT_MAX_DIMENSION;

  try {
    const bitmap = await createImageBitmap(file);
    let { width, height } = bitmap;
    if (maxDim > 0 && Math.max(width, height) > maxDim) {
      const scale = maxDim / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob: Blob | null = await new Promise((resolve) => {
      canvas.toBlob(resolve, "image/webp", quality);
    });
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
