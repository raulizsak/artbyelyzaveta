import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { localSupabaseConfig } from "./local-supabase.cjs";
localSupabaseConfig();
const root = "test-results/private-readiness/";
const target = JSON.parse(await readFile(root + "restore-target.json", "utf8"));
assert.equal(target.database, "prelaunch_restore_20261028");
assert.equal(target.container, "supabase_db_art-by-elyzaveta");
const files = [
  "20261028002128_prelaunch_inventory_integrity.sql",
  "20261028004119_prelaunch_media_access.sql",
  "20261028005325_prelaunch_tracking_event_order.sql",
];
let bundle = "begin;\n";
for (const file of files) {
  const source = await readFile("supabase/migrations/" + file, "utf8");
  const version = file.slice(0, 14),
    name = file.slice(15, -4);
  assert.ok(!source.includes("$migration_source$"));
  bundle +=
    source +
    "\ninsert into supabase_migrations.schema_migrations(version,name,statements) values ('" +
    version +
    "','" +
    name +
    "',array[$migration_source$" +
    source +
    "$migration_source$]);\n";
}
bundle += "notify pgrst, 'reload schema';\ncommit;";
await writeFile(root + "apply-three-migrations.sql", bundle);
const result = spawnSync(
  "docker",
  [
    "exec",
    "-i",
    target.container,
    "psql",
    "-X",
    "-U",
    "postgres",
    "-d",
    target.database,
    "-v",
    "ON_ERROR_STOP=1",
    "-Atq",
  ],
  { input: bundle, encoding: "utf8", maxBuffer: 1024 * 1024 },
);
if (result.status) {
  await writeFile(root + "migration-rehearsal-error.log", result.stderr);
  throw Error("Migration rehearsal failed; private diagnostic saved");
}
const test = await readFile("supabase/tests/prelaunch_commerce.sql", "utf8");
const tested = spawnSync(
  "docker",
  [
    "exec",
    "-i",
    target.container,
    "psql",
    "-X",
    "-U",
    "postgres",
    "-d",
    target.database,
    "-v",
    "ON_ERROR_STOP=1",
    "-Atq",
  ],
  {
    input:
      "create extension if not exists pgtap with schema extensions; grant usage on schema extensions to service_role; set search_path=public,extensions;\n" +
      test,
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  },
);
await writeFile(root + "rehearsal-pgtap.log", tested.stdout + tested.stderr);
if (tested.status || /not ok/.test(tested.stdout))
  throw Error("Rehearsal regression failed; private log saved");
const proof = {
  database: target.database,
  migrations: files,
  assertions: 23,
  productionWrites: false,
  verifiedAt: new Date().toISOString(),
};
await writeFile(
  root + "migration-rehearsal-proof.json",
  JSON.stringify(proof, null, 2),
);
console.log(JSON.stringify(proof));
