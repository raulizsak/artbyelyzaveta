import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const execute = process.argv.includes("--execute");
const exportArg = process.argv.find((value) =>
  value.startsWith("--export-dir="),
);
const exportDir =
  exportArg?.slice("--export-dir=".length) || process.env.CONVEX_EXPORT_DIR;
const root = process.cwd();
if (!exportDir)
  throw new Error("Provide --export-dir=<unpacked Convex export path>.");

const readJsonLines = async (relative) => {
  const content = await readFile(path.join(exportDir, relative), "utf8");
  return content
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
};
const paintings = await readJsonLines("paintings/documents.jsonl");
const contacts = await readJsonLines("contactEnquiries/documents.jsonl");
const commissions = await readJsonLines("commissionEnquiries/documents.jsonl");
const storageRecords = await readJsonLines("_storage/documents.jsonl");
const manifest = JSON.parse(
  await readFile(path.join(root, "supabase/media-manifest.json"), "utf8"),
);

const expected = {
  paintings: paintings.length,
  contactEnquiries: contacts.length,
  commissionEnquiries: commissions.length,
  inspirationFiles: commissions.reduce(
    (sum, item) => sum + (item.inspirationFiles?.length ?? 0),
    0,
  ),
  storageFiles: storageRecords.length,
  optimizedArtworkFiles: manifest.media.length,
};
if (!execute) {
  console.log(
    JSON.stringify({ mode: "dry-run", validated: true, expected }, null, 2),
  );
  process.exit(0);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key)
  throw new Error("Supabase server credentials are required for --execute.");
const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const upload = async (bucket, storagePath, localPath, contentType) => {
  const bytes = await readFile(localPath);
  const { error } = await supabase.storage
    .from(bucket)
    .upload(storagePath, bytes, {
      contentType,
      upsert: true,
      cacheControl: bucket === "artwork-public" ? "31536000" : "3600",
    });
  if (error)
    throw new Error(`Storage upload failed in ${bucket}: ${error.message}`);
};

for (const painting of paintings) {
  const createdAt = new Date(
    painting.createdAt ?? painting._creationTime,
  ).toISOString();
  const { data: target, error } = await supabase
    .from("paintings")
    .upsert(
      {
        legacy_convex_id: painting._id,
        slug: painting.slug,
        title: painting.title,
        description: painting.description ?? "",
        story: painting.story ?? "",
        price_cents: painting.price,
        currency: painting.currency ?? "AUD",
        width_cm: painting.widthCm ?? null,
        height_cm: painting.heightCm ?? null,
        depth_cm: painting.depthCm ?? null,
        medium: painting.medium ?? null,
        surface: painting.surface ?? null,
        category: painting.category ?? null,
        orientation: painting.orientation ?? null,
        framed: Boolean(painting.framed),
        frame_description: painting.frameDescription ?? null,
        signed: painting.signed ?? true,
        ready_to_hang: painting.readyToHang ?? true,
        certificate: painting.certificate ?? true,
        status: painting.status,
        featured: Boolean(painting.featured),
        year: painting.year ?? null,
        seo_title: painting.seoTitle ?? null,
        seo_description: painting.seoDescription ?? null,
        published_at: painting.status === "draft" ? null : createdAt,
        created_at: createdAt,
      },
      { onConflict: "legacy_convex_id" },
    )
    .select("id")
    .single();
  if (error || !target)
    throw new Error(
      `Painting migration failed: ${error?.message ?? "missing target"}`,
    );

  const mediaRows = [];
  for (const media of manifest.media) {
    await upload(
      "artwork-public",
      media.storagePath,
      path.join(root, media.localPath),
      media.mimeType,
    );
    mediaRows.push({
      painting_id: target.id,
      kind: media.kind,
      storage_path: media.storagePath,
      variant: media.variant,
      width: media.width,
      height: media.height,
      bytes: media.bytes,
      mime_type: media.mimeType,
      alt_text: media.altText,
      position: media.position,
    });
  }
  for (let position = 0; position < painting.media.length; position += 1) {
    const media = painting.media[position];
    const localPath = path.join(root, "public", media.src.replace(/^\//, ""));
    const file = await stat(localPath);
    const extension = path.extname(localPath).toLowerCase();
    const mime =
      extension === ".png"
        ? "image/png"
        : extension === ".webp"
          ? "image/webp"
          : "image/jpeg";
    const storagePath = `paintings/${painting.slug}/original/${path.basename(localPath)}`;
    await upload("artwork-originals", storagePath, localPath, mime);
    mediaRows.push({
      painting_id: target.id,
      kind: media.kind,
      storage_path: storagePath,
      variant: "original",
      width: media.width,
      height: media.height,
      bytes: file.size,
      mime_type: mime,
      alt_text: media.alt,
      position,
    });
  }
  const { error: mediaError } = await supabase
    .from("painting_media")
    .upsert(mediaRows, { onConflict: "storage_path" });
  if (mediaError)
    throw new Error(`Painting media migration failed: ${mediaError.message}`);
}

for (const contact of contacts) {
  const { error } = await supabase.from("contact_enquiries").upsert(
    {
      legacy_convex_id: contact._id,
      name: contact.name,
      email: contact.email,
      subject: contact.subject || "General enquiry",
      message: contact.message,
      consent: contact.consent,
      status: contact.status,
      created_at: new Date(
        contact.createdAt ?? contact._creationTime,
      ).toISOString(),
    },
    { onConflict: "legacy_convex_id" },
  );
  if (error) throw new Error(`Contact migration failed: ${error.message}`);
}

const storageById = new Map(
  storageRecords.map((record) => [record._id, record]),
);
for (const commission of commissions) {
  const { data: target, error } = await supabase
    .from("commission_enquiries")
    .upsert(
      {
        legacy_convex_id: commission._id,
        name: commission.name,
        email: commission.email,
        phone: commission.phone || null,
        subject: commission.subject || "Commission enquiry",
        dimensions: commission.dimensions || null,
        budget: commission.budget || null,
        timing: commission.timing || null,
        inspiration: commission.inspiration,
        notes: commission.notes || null,
        consent: commission.consent,
        status: commission.status,
        created_at: new Date(
          commission.createdAt ?? commission._creationTime,
        ).toISOString(),
      },
      { onConflict: "legacy_convex_id" },
    )
    .select("id")
    .single();
  if (error || !target)
    throw new Error(
      `Commission migration failed: ${error?.message ?? "missing target"}`,
    );
  const fileRows = [];
  for (const file of commission.inspirationFiles ?? []) {
    const metadata = storageById.get(file.storageId);
    if (!metadata)
      throw new Error("Commission storage metadata was not found.");
    const localExtension =
      metadata.contentType === "image/png"
        ? "png"
        : metadata.contentType === "image/webp"
          ? "webp"
          : metadata.contentType === "image/jpeg"
            ? "jpeg"
            : "";
    const localPath = path.join(
      exportDir,
      "_storage",
      `${file.storageId}${localExtension ? `.${localExtension}` : ""}`,
    );
    const extension =
      metadata.contentType === "image/png"
        ? "png"
        : metadata.contentType === "image/webp"
          ? "webp"
          : "jpg";
    const storagePath = `legacy/${commission._id}/${file.storageId}.${extension}`;
    await upload(
      "commission-inspiration",
      storagePath,
      localPath,
      metadata.contentType,
    );
    fileRows.push({
      commission_enquiry_id: target.id,
      legacy_storage_id: file.storageId,
      storage_path: storagePath,
      mime_type: metadata.contentType,
      bytes: metadata.size,
    });
  }
  if (fileRows.length) {
    const { error: filesError } = await supabase
      .from("commission_inspiration_files")
      .upsert(fileRows, { onConflict: "legacy_storage_id" });
    if (filesError)
      throw new Error(
        `Commission file migration failed: ${filesError.message}`,
      );
  }
}

const count = async (table) =>
  (await supabase.from(table).select("id", { count: "exact", head: true }))
    .count ?? -1;
const destination = {
  paintings: await count("paintings"),
  contactEnquiries: await count("contact_enquiries"),
  commissionEnquiries: await count("commission_enquiries"),
  inspirationFiles: await count("commission_inspiration_files"),
};
const migratedLegacy = await supabase
  .from("paintings")
  .select("legacy_convex_id, slug, status, created_at")
  .not("legacy_convex_id", "is", null);
if (migratedLegacy.error || migratedLegacy.data.length !== expected.paintings)
  throw new Error("Painting verification failed.");
if (
  destination.contactEnquiries < expected.contactEnquiries ||
  destination.commissionEnquiries < expected.commissionEnquiries ||
  destination.inspirationFiles < expected.inspirationFiles
)
  throw new Error("Destination count verification failed.");
console.log(
  JSON.stringify(
    { mode: "execute", verified: true, source: expected, destination },
    null,
    2,
  ),
);
