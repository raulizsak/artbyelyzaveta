// Disposable local QA only. Refuse cloud hosts, and never inherit live providers.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { localSupabaseConfig } from "./local-supabase.cjs";
const require = createRequire(import.meta.url);

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  const config = localSupabaseConfig();
  const env = {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: config.API_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: config.ANON_KEY,
    SUPABASE_SECRET_KEY: config.SERVICE_ROLE_KEY,
    NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3000",
    SITE_URL: "http://127.0.0.1:3000",
    ALLOW_LOCAL_CATALOGUE_FIXTURE: "false",
    PAYMENT_MODE: "test",
    ENABLE_LIVE_CHECKOUT: "false",
    ENABLE_TEST_CHECKOUT: "false",
    ENABLE_DEMO_CHECKOUT: "false",
    STRIPE_LIVE_SECRET_KEY: "",
    STRIPE_TEST_SECRET_KEY: "",
    STRIPE_SECRET_KEY: "",
    NEXT_PUBLIC_STRIPE_LIVE_PUBLISHABLE_KEY: "",
    NEXT_PUBLIC_STRIPE_TEST_PUBLISHABLE_KEY: "",
    TRACK17_API_KEY: "",
    SMTP2GO_SMTP_USER: "",
    SMTP2GO_SMTP_PASSWORD: "",
    SMTP2GO_API_KEY: "",
    EMAIL_DELIVERY_MODE: "test",
    EMAIL_TEST_RECIPIENT: "qa@example.test",
    ADMIN_EMAIL: "",
    PREVIEW_GATE_ENABLED: "false",
    ENABLE_SEARCH_INDEXING: "false",
  };
  const server = spawn(
    process.execPath,
    [
      require.resolve("next/dist/bin/next"),
      ...({ build: ["build"], start: ["start"] }[process.argv[2]] ?? [
        "dev",
        "--turbopack",
      ]),
    ],
    { env, stdio: "inherit", windowsHide: true },
  );
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => server.kill(signal));
  server.on("exit", (code) => process.exit(code ?? 0));
}
