// Restore only into an explicitly named, separate LOCAL database. The cloud is
// never a write target. Private SQL/data and diagnostic output stay ignored.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { localSupabaseConfig } from "./local-supabase.cjs";

localSupabaseConfig();
const root = resolve("test-results/private-readiness");
const target = "prelaunch_restore_20261028";
const container = "supabase_db_art-by-elyzaveta";
const snapshotText = await readFile(
  resolve(root, "database-snapshot.json"),
  "utf8",
);
const snapshot = JSON.parse(snapshotText)[0].recovery_snapshot;
assert.equal(snapshot.project_ref, "fhxgcvdwvagqnxgydyca");
const qi = (value) => `"${String(value).replaceAll('"', '""')}"`;
const qs = (value) => `'${String(value).replaceAll("'", "''")}'`;
const run = (database, sql, label) => {
  assert.ok(database === "postgres" || database === target);
  const result = spawnSync(
    "docker",
    [
      "exec",
      "-i",
      container,
      "psql",
      "-X",
      "-U",
      "postgres",
      "-d",
      database,
      "-v",
      "ON_ERROR_STOP=1",
      "-Atq",
    ],
    {
      input: sql,
      encoding: "utf8",
      maxBuffer: 30 * 1024 * 1024,
    },
  );
  if (result.status !== 0) {
    // Do not leak row contents in a failed restore diagnostic.
    return { failed: true, label, output: result.stdout, error: result.stderr };
  }
  return { failed: false, output: result.stdout };
};
const checked = async (database, sql, label) => {
  const result = run(database, sql, label);
  if (result.failed) {
    await writeFile(resolve(root, `restore-${label}-error.log`), result.error);
    throw new Error(
      `Local restore step ${label} failed; private diagnostic saved`,
    );
  }
  return result.output;
};
const decodeXml = (text) =>
  text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, entity) => {
    if (entity.startsWith("#x"))
      return String.fromCodePoint(parseInt(entity.slice(2), 16));
    if (entity.startsWith("#"))
      return String.fromCodePoint(parseInt(entity.slice(1), 10));
    return { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }[entity];
  });
for (const table of snapshot.tables) {
  table.records = JSON.parse(
    decodeXml(table.records_xml.match(/<records>([\s\S]*?)<\/records>/)[1]),
  );
  table.expectedCount = Number(
    table.records_xml.match(/<row_count>(\d+)<\/row_count>/)[1],
  );
  table.expectedChecksum = table.records_xml.match(
    /<checksum>([a-f0-9]+)<\/checksum>/,
  )[1];
  assert.equal(table.records.length, table.expectedCount);
}
const exists =
  (
    await checked(
      "postgres",
      `select exists(select 1 from pg_database where datname=${qs(target)});`,
      "exists",
    )
  ).trim() === "t";
let journal;
if (exists) {
  journal = JSON.parse(
    await readFile(resolve(root, "restore-target.json"), "utf8"),
  );
  assert.equal(journal.container, container);
  assert.equal(journal.database, target);
  if (journal.snapshotSha256)
    assert.equal(
      journal.snapshotSha256,
      createHash("sha256").update(snapshotText).digest("hex"),
    );
} else {
  await checked("postgres", `create database ${qi(target)};`, "create");
  journal = {
    container,
    database: target,
    createdAt: new Date().toISOString(),
  };
}
journal.snapshotSha256 = createHash("sha256")
  .update(snapshotText)
  .digest("hex");
await writeFile(resolve(root, "restore-target.json"), JSON.stringify(journal));
// Keep the foundation captured with the backup. A later local migration/reset
// must not silently replace the schema used by the original restore rehearsal.
let schema;
try {
  schema = await readFile(resolve(root, "local-foundation-schema.sql"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  schema = execFileSync(
    "docker",
    [
      "exec",
      container,
      "pg_dump",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "--schema-only",
      "--no-owner",
      "--no-privileges",
      "--schema=public",
      "--schema=private",
      "--schema=auth",
      "--schema=storage",
    ],
    { maxBuffer: 30 * 1024 * 1024 },
  );
  await writeFile(resolve(root, "local-foundation-schema.sql"), schema);
}
const existingTableCount = Number(
  (
    await checked(
      target,
      "select count(*) from pg_tables where schemaname in ('public','private','auth','storage');",
      "foundation-state",
    )
  ).trim(),
);
if (!existingTableCount)
  await checked(
    target,
    'create schema if not exists extensions; create extension if not exists "uuid-ossp" with schema extensions; create extension if not exists pgcrypto with schema extensions;\n' +
      schema
        .toString("utf8")
        .replace(/^CREATE SCHEMA (.+);$/gm, "CREATE SCHEMA IF NOT EXISTS $1;"),
    "schema",
  );

// Scheduler history is restored as inert tables, never as active cron jobs.
// Migration history is also data. These schemas are absent from the foundation.
for (const table of snapshot.tables.filter((table) =>
  ["cron", "supabase_migrations"].includes(table.schema),
)) {
  await checked(
    target,
    `create schema if not exists ${qi(table.schema)}; create table if not exists ${qi(table.schema)}.${qi(table.name)} (${table.columns.map((column) => `${qi(column.name)} ${column.type}`).join(",")});`,
    "inert-metadata",
  );
}
const actualColumns = JSON.parse(
  (
    await checked(
      target,
      "select json_agg(json_build_object('schema',table_schema,'table',table_name,'column',column_name)) from information_schema.columns where table_schema in ('public','private','auth','storage','cron','supabase_migrations');",
      "columns",
    )
  ).trim(),
);
const knownColumns = new Set(
  actualColumns.map(
    (column) => `${column.schema}.${column.table}.${column.column}`,
  ),
);
const missing = snapshot.tables.flatMap((table) =>
  table.columns
    .filter(
      (column) =>
        !knownColumns.has(`${table.schema}.${table.name}.${column.name}`),
    )
    .map((column) => `${table.schema}.${table.name}.${column.name}`),
);
await writeFile(
  resolve(root, "restore-missing-columns.json"),
  JSON.stringify(missing),
);
assert.ok(
  missing.every((column) => /^(auth|storage)\./.test(column)),
  "Application schema drift requires review before restoration",
);
const definition = (column) =>
  `${qi(column.name)} ${column.type}${column.generated ? ` generated always as (${column.default}) stored` : column.default ? ` default ${column.default}` : ""}${column.not_null ? " not null" : ""}`;
for (const table of snapshot.tables.filter((table) =>
  ["auth", "storage"].includes(table.schema),
)) {
  const newColumns = table.columns.filter((column) =>
    missing.includes(`${table.schema}.${table.name}.${column.name}`),
  );
  if (!newColumns.length) continue;
  if (newColumns.length === table.columns.length) {
    await checked(
      target,
      `create table ${qi(table.schema)}.${qi(table.name)} (${table.columns.map(definition).join(",")});`,
      "managed-table-compatibility",
    );
  } else {
    await checked(
      target,
      `alter table ${qi(table.schema)}.${qi(table.name)} ${newColumns.map((column) => `add column ${definition(column)}`).join(",")};`,
      "managed-column-compatibility",
    );
  }
}
let dataSql =
  "begin; set timezone='UTC'; set session_replication_role=replica;\n";
for (const table of snapshot.tables) {
  if (!table.records.length) continue;
  const columns = table.columns
    .filter((column) => !column.generated)
    .map((column) => qi(column.name))
    .join(",");
  const delimiter = `$recovery_${randomUUID().replaceAll("-", "")}$`;
  dataSql += `insert into ${qi(table.schema)}.${qi(table.name)} (${columns}) overriding system value select ${columns} from jsonb_populate_recordset(null::${qi(table.schema)}.${qi(table.name)},${delimiter}${JSON.stringify(table.records)}${delimiter}::jsonb);\n`;
}
dataSql += "set session_replication_role=origin; commit;\n";
await writeFile(resolve(root, "restore-private-data.sql"), dataSql);
if (!journal.dataRestored) {
  await checked(target, dataSql, "data");
  journal.dataRestored = true;
  await writeFile(
    resolve(root, "restore-target.json"),
    JSON.stringify(journal),
  );
}
await checked(
  target,
  snapshot.functions.map((fn) => fn.ddl + ";").join("\n"),
  "source-functions",
);
const verification = [];
for (const table of snapshot.tables) {
  const projection = table.columns.map((column) => qi(column.name)).join(",");
  const value = JSON.parse(
    (
      await checked(
        target,
        `set timezone='UTC'; select json_build_object('count',count(*),'checksum',md5(coalesce(jsonb_agg(to_jsonb(t) order by md5(to_jsonb(t)::text)), '[]'::jsonb)::text)) from (select ${projection} from ${qi(table.schema)}.${qi(table.name)}) t;`,
        "verify",
      )
    ).trim(),
  );
  assert.equal(
    Number(value.count),
    table.expectedCount,
    `Row count changed for ${table.schema}.${table.name}`,
  );
  assert.equal(
    value.checksum,
    table.expectedChecksum,
    `Content changed for ${table.schema}.${table.name}`,
  );
  verification.push({
    table: `${table.schema}.${table.name}`,
    rows: value.count,
    checksumMatches: true,
  });
}
const proof = {
  database: target,
  container,
  productionWrites: false,
  snapshotSha256: createHash("sha256").update(snapshotText).digest("hex"),
  restoredAt: new Date().toISOString(),
  tables: verification,
};
await writeFile(
  resolve(root, "restore-proof.json"),
  JSON.stringify(proof, null, 2),
);
console.log(
  JSON.stringify({
    isolatedDatabase: target,
    verifiedTables: verification.length,
    verifiedRows: verification.reduce(
      (sum, table) => sum + Number(table.rows),
      0,
    ),
    productionWrites: false,
  }),
);
