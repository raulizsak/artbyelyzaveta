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

// PostgreSQL does not expose argument nullability to the generator. These
// existing RPCs deliberately accept NULL for inapplicable/cleared fields.
const nullableArguments = {
  admin_save_discount: [
    "p_discount_id",
    "p_percent_off",
    "p_amount_off_cents",
    "p_ends_at",
    "p_max_redemptions",
    "p_minimum_subtotal_cents",
  ],
  admin_complete_tracking_registration: ["p_error"],
};
let types = stdout;
for (const [name, arguments_] of Object.entries(nullableArguments)) {
  const block = new RegExp("(\\b" + name + ": \\{\\s*Args: \\{)([^}]*)(\\})");
  if (!block.test(types))
    throw new Error("Expected RPC missing from generated types: " + name);
  types = types.replace(block, (_, head, body, tail) => {
    for (const argument of arguments_)
      body = body.replace(
        new RegExp("(\\b" + argument + "\\??: )(string|number)(?![\\w|])"),
        "$1$2 | null",
      );
    return head + body + tail;
  });
}
await writeFile(output, `${types.trimEnd()}\n`, "utf8");
if (stderr.trim()) process.stderr.write(stderr);
console.log(
  `Generated ${path.relative(root, output)} from ${projectArg ? "the linked cloud project" : "local Supabase"}.`,
);
