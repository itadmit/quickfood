/**
 * Build PNG icons used in transactional emails.
 *
 *   $ npx tsx scripts/build-wa-icon.ts
 *
 * Outputs:
 *   /public/img/whatsapp-white.png - white WhatsApp glyph for the support CTA
 *   /public/img/star-yellow.png    - filled yellow star for the review CTA
 *
 * Why PNG: Gmail web strips data: URIs from <img src> and silently mangles
 * inline SVG. PNG hosted at the public origin works everywhere.
 */
import sharp from "sharp";
import path from "node:path";

const WA_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="#ffffff"><path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.51 5.26l.4.634-1.001 3.656 3.748-1.244.832.495zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.867-2.031-.967-.272-.099-.47-.148-.669.15-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.297-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>`;

// Filled star - brand yellow with thin black outline so it stays readable
// against both the cream page bg and the white card.
const STAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 24 24" fill="#F8CB1E" stroke="#000000" stroke-width="1.2" stroke-linejoin="round"><path d="M12 2.5l2.92 5.92 6.53.95-4.72 4.6 1.11 6.5L12 17.4l-5.84 3.07 1.11-6.5L2.55 9.37l6.53-.95L12 2.5z"/></svg>`;

async function writePng(svg: string, size: number, name: string) {
  const out = path.resolve(__dirname, "..", "public", "img", name);
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log("wrote", out);
}

async function main() {
  await writePng(WA_SVG, 64, "whatsapp-white.png");
  await writePng(STAR_SVG, 128, "star-yellow.png");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
