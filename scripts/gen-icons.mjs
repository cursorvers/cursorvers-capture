import sharp from "sharp";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const NAVY = "#0a1a4a";

// Canonical brand raster (2048×2048, dark navy + Cursorvers wordmark).
// Lives at public/brand/cursorvers-logo-2048.jpg so the asset is committed
// alongside the source.
const RASTER = join(root, "public", "brand", "cursorvers-logo-2048.jpg");

async function pngPlain(size, outPath) {
  await sharp(RASTER).resize(size, size).png().toFile(outPath);
}

async function pngMaskable(size, outPath) {
  // PWA maskable spec recommends keeping the mark within a 80% inner
  // circle. The Cursorvers logo already has generous padding so a flat
  // 80% inset inside a navy canvas is sufficient.
  const inner = Math.round(size * 0.8);
  const offset = Math.floor((size - inner) / 2);
  const innerBuf = await sharp(RASTER).resize(inner, inner).png().toBuffer();
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: NAVY,
    },
  })
    .composite([{ input: innerBuf, left: offset, top: offset }])
    .png()
    .toFile(outPath);
}

await pngPlain(192, join(root, "public", "icon-192.png"));
await pngPlain(512, join(root, "public", "icon-512.png"));
await pngMaskable(192, join(root, "public", "icon-maskable-192.png"));
await pngMaskable(512, join(root, "public", "icon-maskable-512.png"));
await pngPlain(32, join(root, "app", "icon.png"));
await pngPlain(180, join(root, "app", "apple-icon.png"));

console.log("Icons generated from Cursorvers brand raster.");
