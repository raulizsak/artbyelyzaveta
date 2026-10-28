import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { localSupabaseConfig } from "./local-supabase.cjs";
localSupabaseConfig();
const root = "test-results/private-readiness/";
const target = JSON.parse(await readFile(root + "restore-target.json", "utf8"));
assert.equal(target.database, "prelaunch_restore_20261028");
assert.equal(target.container, "supabase_db_art-by-elyzaveta");
const snapshot = JSON.parse(
  await readFile(root + "database-snapshot.json", "utf8"),
)[0].recovery_snapshot;
const security = JSON.parse(
  await readFile(root + "security-snapshot.json", "utf8"),
)[0].security_snapshot;
const q = (x) => '"' + String(x).replaceAll('"', '""') + '"';
const role = (x) => (x === "PUBLIC" ? "PUBLIC" : q(x));
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
    { input: sql, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
  );
  if (result.status)
    throw new Error(
      result.stderr.split("\n").find((line) => line.startsWith("ERROR")) ||
        "Local security restoration failed",
    );
  return result.stdout;
};
let sql = "begin;\n";
const policies = JSON.parse(
  run(
    "select coalesce(json_agg(json_build_object('schema',schemaname,'table',tablename,'name',policyname)),'[]') from pg_policies where schemaname in ('public','private','storage');",
  ),
);
for (const policy of policies)
  sql +=
    "drop policy " +
    q(policy.name) +
    " on " +
    q(policy.schema) +
    "." +
    q(policy.table) +
    ";\n";
for (const policy of snapshot.policies)
  sql +=
    "create policy " +
    q(policy.policyname) +
    " on " +
    q(policy.schemaname) +
    "." +
    q(policy.tablename) +
    " as " +
    policy.permissive +
    " for " +
    policy.cmd +
    " to " +
    policy.roles.map(role).join(",") +
    (policy.qual ? " using (" + policy.qual + ")" : "") +
    (policy.with_check ? " with check (" + policy.with_check + ")" : "") +
    ";\n";
for (const table of snapshot.tables.filter((table) =>
  ["public", "private", "auth", "storage"].includes(table.schema),
)) {
  const tableName = q(table.schema) + "." + q(table.name);
  sql +=
    "alter table " +
    tableName +
    (table.rls ? " enable" : " disable") +
    " row level security;\n";
  sql +=
    "revoke all on table " +
    tableName +
    " from public, anon, authenticated, service_role;\n";
}
for (const schema of ["public", "private", "auth", "storage"])
  sql +=
    "revoke all on schema " +
    q(schema) +
    " from public, anon, authenticated, service_role;\n";
for (const grant of security.schema_grants)
  sql +=
    "grant " +
    grant.privilege +
    " on schema " +
    q(grant.schema) +
    " to " +
    role(grant.grantee) +
    (grant.grantable ? " with grant option" : "") +
    ";\n";
for (const grant of security.table_grants)
  sql +=
    "grant " +
    grant.privilege +
    " on table " +
    q(grant.schema) +
    "." +
    q(grant.table) +
    " to " +
    role(grant.grantee) +
    (grant.grantable ? " with grant option" : "") +
    ";\n";
for (const fn of snapshot.functions)
  sql +=
    "revoke all on function " +
    q(fn.schema) +
    "." +
    q(fn.name) +
    "(" +
    fn.arguments +
    ") from public, anon, authenticated, service_role;\n";
for (const grant of security.function_grants)
  sql +=
    "grant " +
    grant.privilege +
    " on function " +
    q(grant.schema) +
    "." +
    q(grant.name) +
    "(" +
    grant.arguments +
    ") to " +
    role(grant.grantee) +
    (grant.grantable ? " with grant option" : "") +
    ";\n";
sql += "commit;";
await writeFile(root + "restore-security.sql", sql);
run(sql);
const counts = JSON.parse(
  run(
    "select json_build_object('policies',count(*)) from pg_policies where schemaname in ('public','private','storage');",
  ),
);
assert.equal(Number(counts.policies), snapshot.policies.length);
console.log(
  JSON.stringify({
    isolatedDatabase: target.database,
    policiesRestored: counts.policies,
    schemaGrants: security.schema_grants.length,
    tableGrants: security.table_grants.length,
    functionGrants: security.function_grants.length,
    productionWrites: false,
  }),
);
