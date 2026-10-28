import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { localSupabaseConfig } from "./local-supabase.cjs";

localSupabaseConfig();
const root = "test-results/private-readiness/";
const target = JSON.parse(await readFile(root + "restore-target.json", "utf8"));
assert.equal(target.database, "prelaunch_restore_20261028");
assert.equal(target.container, "supabase_db_art-by-elyzaveta");
const file = "20261028095346_reliable_notification_delivery.sql";
const source = await readFile("supabase/migrations/" + file, "utf8");
assert.ok(!source.includes("$migration_source$"));
const bundle =
  "begin;\n" +
  source +
  "\ninsert into supabase_migrations.schema_migrations(version,name,statements) values ('" +
  file.slice(0, 14) +
  "','" +
  file.slice(15, -4) +
  "',array[$migration_source$" +
  source +
  "$migration_source$]);\ncommit;";
const run = (sql) => {
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
    { input: sql, encoding: "utf8", maxBuffer: 2 * 1024 * 1024 },
  );
  if (result.status) {
    throw new Error(
      result.stderr.replace(/DETAIL:[\s\S]*/, "Private row detail omitted"),
    );
  }
  return result.stdout;
};
await writeFile(root + "apply-notification-migration.sql", bundle);
const applied = run(
  "select count(*) from supabase_migrations.schema_migrations where version='" +
    file.slice(0, 14) +
    "';",
).trim();
if (applied === "0") run(bundle);
else
  assert.equal(
    run(
      "select statements[1] = $migration_source$" +
        source +
        "$migration_source$ from supabase_migrations.schema_migrations where version='" +
        file.slice(0, 14) +
        "';",
    ).trim(),
    "t",
    "Rehearsal history differs; stop before changing restored source",
  );
const adminId = run(
  "select id from public.profiles where role='admin' limit 1;",
).trim();
assert.match(adminId, /^[\da-f-]{36}$/);
const test = (
  await readFile("supabase/tests/notifications.sql", "utf8")
).replaceAll("11111111-1111-4111-8111-111111111111", adminId);
const output = run("set search_path=public,extensions;\n" + test);
await writeFile(root + "notification-rehearsal-pgtap.log", output);
assert.ok(!/not ok/.test(output), "Notification regression failed");
const proof = {
  migration: file,
  transactionSha256: createHash("sha256").update(bundle).digest("hex"),
  assertions: Number(test.match(/plan\((\d+)\)/)[1]),
  productionWrites: false,
  verifiedAt: new Date().toISOString(),
};
await writeFile(
  root + "notification-rehearsal-proof.json",
  JSON.stringify(proof, null, 2),
);
console.log(JSON.stringify(proof));
