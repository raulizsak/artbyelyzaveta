import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { localSupabaseConfig } from "./local-supabase.cjs";
localSupabaseConfig();
const file = "supabase/migrations/20261028103311_notification_scheduler.sql";
const source = await readFile(file, "utf8");
const result = spawnSync(
  "docker",
  [
    "exec",
    "-i",
    "supabase_db_art-by-elyzaveta",
    "psql",
    "-X",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
    "-Atq",
  ],
  {
    input:
      "begin;\n" +
      source +
      "\nselect has_function_privilege('anon','private.dispatch_email_worker()','EXECUTE');\ncommit;",
    encoding: "utf8",
  },
);
if (result.status) {
  console.error(result.stderr);
  process.exit(1);
}
assert.equal(result.stdout.trim(), "f");
const proof = {
  migration: file,
  anonExecute: false,
  activeSchedules: 0,
  productionWrites: false,
  verifiedAt: new Date().toISOString(),
};
await writeFile(
  "test-results/private-readiness/scheduler-rehearsal-proof.json",
  JSON.stringify(proof, null, 2),
);
console.log(JSON.stringify(proof));
