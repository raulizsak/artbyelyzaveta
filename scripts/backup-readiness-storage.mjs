// Read-only export from the explicitly verified store. Output contains private
// originals/customer files and must remain outside version control.
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";

const root = resolve("test-results/private-readiness");
const rows = JSON.parse(
  await readFile(resolve(root, "render-env.json"), "utf8"),
);
const env = Object.fromEntries(rows.map(({ key, value }) => [key, value]));
if (env.NEXT_PUBLIC_SUPABASE_URL !== "https://fhxgcvdwvagqnxgydyca.supabase.co")
  throw new Error("Refusing to export an unverified project");
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});
const { data: buckets, error } = await db.storage.listBuckets();
if (error) throw new Error("Unable to list store buckets");
const files = [];
async function walk(bucket, prefix = "") {
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.storage.from(bucket).list(prefix, {
      limit: 1000,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw new Error(`Unable to enumerate bucket ${bucket}`);
    for (const item of data ?? []) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (!item.id) {
        await walk(bucket, path);
        continue;
      }
      const destination = resolve(root, "storage", bucket, path);
      if (!destination.startsWith(resolve(root, "storage") + sep))
        throw new Error("Unsafe object path");
      const downloaded = await db.storage.from(bucket).download(path);
      if (downloaded.error || !downloaded.data)
        throw new Error(`Unable to back up an object in ${bucket}`);
      const bytes = Buffer.from(await downloaded.data.arrayBuffer());
      await mkdir(dirname(destination), { recursive: true });
      await writeFile(destination, bytes);
      files.push({
        bucket,
        path,
        bytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        metadata: item,
      });
    }
    if (!data || data.length < 1000) break;
  }
}
for (const bucket of buckets ?? []) await walk(bucket.id);
await writeFile(
  resolve(root, "storage-manifest.json"),
  JSON.stringify(
    {
      projectRef: "fhxgcvdwvagqnxgydyca",
      capturedAt: new Date().toISOString(),
      buckets,
      files,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    buckets: buckets?.length,
    files: files.length,
    bytes: files.reduce((sum, file) => sum + file.bytes, 0),
    privateExport: true,
  }),
);
