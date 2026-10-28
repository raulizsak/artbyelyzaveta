/* eslint-disable @typescript-eslint/no-require-imports -- Shared Node CLI helper for Playwright's CommonJS runner. */
const { execFileSync } = require("node:child_process");
const { join } = require("node:path");

exports.localSupabaseConfig = function localSupabaseConfig() {
  const output = execFileSync(
    process.execPath,
    [
      join(__dirname, "../node_modules/supabase/dist/supabase.js"),
      "status",
      "-o",
      "json",
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  const config = JSON.parse(output);
  const url = new URL(config.API_URL);
  if (
    url.hostname !== "127.0.0.1" ||
    url.port !== "55431" ||
    config.linked_project
  )
    throw new Error(
      "QA requires the unlinked local Supabase stack on port 55431.",
    );
  return config;
};
