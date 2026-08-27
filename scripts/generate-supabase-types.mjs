import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "node_modules", "supabase", "dist", "supabase.js");
const output = path.join(root, "lib", "supabase", "database.types.ts");
const projectArg = process.argv.find((argument) =>
  argument.startsWith("--project-id="),
);
const targetArgs = projectArg
  ? ["--project-id", projectArg.slice("--project-id=".length)]
  : ["--local"];

const { stdout, stderr } = await execFileAsync(
  process.execPath,
  [cli, "gen", "types", "typescript", ...targetArgs, "--schema", "public"],
  { cwd: root, maxBuffer: 10 * 1024 * 1024 },
);

if (!stdout.startsWith("export type Json")) {
  throw new Error("Supabase did not return a valid TypeScript schema.");
}

await writeFile(output, stdout, "utf8");
if (stderr.trim()) process.stderr.write(stderr);
console.log(
  `Generated ${path.relative(root, output)} from ${projectArg ? "the linked cloud project" : "local Supabase"}.`,
);
