import sharp from "sharp";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const svgPath = join(root, "app", "icon.svg");
const svg = readFileSync(svgPath);
const NAVY = "#0a1a4a";

async function pngPlain(size, outPath) {
  await sharp(svg).resize(size, size).png().toFile(outPath);
}

async function pngMaskable(size, outPath) {
  const inner = Math.round(size * 0.8);
  const offset = Math.floor((size - inner) / 2);
  const innerBuf = await sharp(svg).resize(inner, inner).png().toBuffer();
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

console.log("Icons generated from Capture SVG.");
