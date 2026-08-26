import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const outputRoot = path.join(root, "public", "optimized");

const artwork = [
  {
    name: "cows-at-dusk-gallery-wall",
    source: "public/artwork/cows-at-dusk-gallery-wall.png",
    kind: "artwork",
    alt: "Cows at Dusk displayed in a simple timber frame on a softly lit wall",
    position: 0,
  },
  {
    name: "cows-at-dusk-warm-room",
    source: "public/artwork/cows-at-dusk-warm-room.png",
    kind: "room",
    alt: "Cows at Dusk displayed above a console in a warm neutral living room",
    position: 1,
  },
  {
    name: "cows-at-dusk-classic-room",
    source: "public/artwork/cows-at-dusk-classic-room.png",
    kind: "room",
    alt: "Cows at Dusk displayed in a classical cream living room",
    position: 2,
  },
  {
    name: "cows-at-dusk-console-room",
    source: "public/artwork/cows-at-dusk-console-room.png",
    kind: "room",
    alt: "Cows at Dusk displayed above a minimalist console",
    position: 3,
  },
  {
    name: "cows-at-dusk-modern-room",
    source: "public/artwork/cows-at-dusk-modern-room.png",
    kind: "room",
    alt: "Cows at Dusk displayed in a modern dining space",
    position: 4,
  },
];

const variants = [
  { name: "thumbnail", width: 300, quality: 78, preferredMax: 100_000 },
  { name: "card", width: 850, quality: 82, preferredMax: 250_000 },
  { name: "main", width: 1600, quality: 85, preferredMax: 500_000 },
  { name: "large", width: 2200, quality: 88, preferredMax: 1_000_000 },
];

await mkdir(path.join(outputRoot, "artwork"), { recursive: true });
await mkdir(path.join(outputRoot, "artist"), { recursive: true });

const manifest = [];
for (const item of artwork) {
  const sourcePath = path.join(root, item.source);
  for (const variant of variants) {
    const relative = path.posix.join(
      "paintings",
      "cows-at-dusk",
      `${item.name}-${variant.name}.webp`,
    );
    const localRelative = path.posix.join(
      "optimized",
      "artwork",
      `${item.name}-${variant.name}.webp`,
    );
    const destination = path.join(root, "public", localRelative);
    const result = await sharp(sourcePath)
      .rotate()
      .resize({ width: variant.width, withoutEnlargement: true })
      .webp({ quality: variant.quality, smartSubsample: true })
      .toFile(destination);
    manifest.push({
      kind: item.kind,
      position: item.position,
      variant: variant.name,
      source: item.source,
      localPath: `public/${localRelative}`,
      storagePath: relative,
      altText: item.alt,
      width: result.width,
      height: result.height,
      bytes: result.size,
      mimeType: "image/webp",
      preferredMaxBytes: variant.preferredMax,
    });
  }
}

const portraitSource = path.join(root, "public", "artist", "lisa-portrait.jpg");
const portraitDestination = path.join(
  outputRoot,
  "artist",
  "lisa-portrait-main.webp",
);
await sharp(portraitSource)
  .rotate()
  .resize({ width: 1200, withoutEnlargement: true })
  .webp({ quality: 84, smartSubsample: true })
  .toFile(portraitDestination);

await writeFile(
  path.join(root, "supabase", "media-manifest.json"),
  `${JSON.stringify({ paintingSlug: "cows-at-dusk", media: manifest }, null, 2)}\n`,
  "utf8",
);

const total = (
  await Promise.all(
    manifest.map((entry) => stat(path.join(root, entry.localPath))),
  )
).reduce((sum, file) => sum + file.size, 0);

console.log(
  JSON.stringify({ files: manifest.length + 1, artworkVariantBytes: total }),
);
