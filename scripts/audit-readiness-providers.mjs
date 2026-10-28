import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
const root = "test-results/private-readiness/";
const env = Object.fromEntries(
  JSON.parse(await readFile(root + "render-env.json", "utf8")).map((x) => [
    x.key,
    x.value,
  ]),
);
assert.equal(
  new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname,
  "fhxgcvdwvagqnxgydyca.supabase.co",
);
const results = {};
for (const mode of ["test", "live"]) {
  const key =
    env[mode === "test" ? "STRIPE_TEST_SECRET_KEY" : "STRIPE_LIVE_SECRET_KEY"];
  assert.ok(key.startsWith(mode === "test" ? "sk_test_" : "sk_live_"));
  const stripe = new Stripe(key);
  const account = await stripe.accounts.retrieve();
  assert.equal(account.id, "acct_1U8UtpJ7PpvmgXCg");
  const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
  results[mode] = {
    account: account.id,
    country: account.country,
    currency: account.default_currency,
    chargesEnabled: account.charges_enabled,
    detailsSubmitted: account.details_submitted,
    webhooks: endpoints.data.map((e) => ({
      id: e.id,
      url: e.url,
      status: e.status,
      events: e.enabled_events,
      apiVersion: e.api_version,
    })),
  };
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const users = await sb.auth.admin.listUsers({ page: 1, perPage: 100 });
if (users.error) throw Error("Auth audit unavailable");
results.auth = {
  users: users.data.users.length,
  approvedInboxAlreadyExists: users.data.users.some(
    (u) => u.email?.toLowerCase() === "hello@artbyelyzaveta.shop",
  ),
  confirmed: users.data.users.filter((u) => u.email_confirmed_at).length,
  mfaUsers: users.data.users.filter((u) =>
    u.factors?.some((f) => f.status === "verified"),
  ).length,
};
await writeFile(root + "provider-audit.json", JSON.stringify(results, null, 2));
console.log(JSON.stringify(results));
