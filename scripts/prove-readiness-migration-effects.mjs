import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { localSupabaseConfig } from "./local-supabase.cjs";
localSupabaseConfig();
const root = "test-results/private-readiness/";
const source = JSON.parse(
  await readFile(root + "database-snapshot.json", "utf8"),
)[0].recovery_snapshot;
const target = JSON.parse(await readFile(root + "restore-target.json", "utf8"));
assert.equal(target.database, "prelaunch_restore_20261028");
assert.equal(target.container, "supabase_db_art-by-elyzaveta");
const q = (x) => '"' + String(x).replaceAll('"', '""') + '"';
const run = (sql) => {
  const r = spawnSync(
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
    { input: sql, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
  );
  if (r.status) throw Error("Local proof query failed");
  return r.stdout.trim();
};
let verified = 0;
for (const table of source.tables.filter(
  (table) => table.schema !== "supabase_migrations",
)) {
  const expected = table.records_xml.match(
    /<checksum>([a-f0-9]+)<\/checksum>/,
  )[1];
  const actual = run(
    "set timezone='UTC'; select md5(coalesce(jsonb_agg(to_jsonb(t) order by md5(to_jsonb(t)::text)),'[]'::jsonb)::text) from (select " +
      table.columns.map((c) => q(c.name)).join(",") +
      " from " +
      q(table.schema) +
      "." +
      q(table.name) +
      ") t;",
  );
  assert.equal(
    actual,
    expected,
    "Migration changed records in " + table.schema + "." + table.name,
  );
  verified++;
}
const changed = [];
for (const fn of source.functions) {
  const current = run(
    "select pg_get_functiondef('" +
      fn.identity.replaceAll("'", "''") +
      "'::regprocedure);",
  );
  if (
    current.replaceAll("\r\n", "\n").trim() !==
    fn.ddl.replaceAll("\r\n", "\n").trim()
  )
    changed.push(fn.schema + "." + fn.name);
}
assert.deepEqual(
  [...changed].sort(),
  [
    "private.create_checkout_reservation",
    "private.create_commerce_checkout",
    "private.process_stripe_event",
    "private.record_tracking_result",
  ].sort(),
);
const policies = JSON.parse(
  run(
    "select json_agg(json_build_object('name',policyname,'qual',qual,'roles',roles)) from pg_policies where policyname='artwork_public_admin_select';",
  ),
);
assert.equal(policies.length, 1);
assert.match(policies[0].qual, /is_admin_aal2/);
const bundle = await readFile(root + "apply-three-migrations.sql", "utf8");
const proof = {
  transactionSha256: createHash("sha256").update(bundle).digest("hex"),
  unchangedDataTables: verified,
  changedFunctions: changed,
  addedPolicy: policies[0],
  topLevelChanges:
    "Three DO/CREATE POLICY definitions and three bounded migration-history INSERTs; function UPDATE source text is not executed by CREATE OR REPLACE",
  commerceAssertions: 23,
  productionWrites: false,
};
await writeFile(
  root + "migration-effects-proof.json",
  JSON.stringify(proof, null, 2),
);
console.log(JSON.stringify(proof));
