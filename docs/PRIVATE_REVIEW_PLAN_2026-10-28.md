# Protected production-readiness plan — 28 October 2026

Checkpoint: `e9970a8` on `prelaunch/production-readiness`; remote main remains `2c17d94`. No launch is authorised. Keep the root Coming Soon and waitlist, preview password, public checkout disabled and indexing disabled throughout.

1. Verify the open store-specific browser sessions. Confirmed Stripe account `acct_1U8UtpJ7PpvmgXCg`, Supabase `fhxgcvdwvagqnxgydyca` (Sydney) and SMTP2GO verified domain. Render session restored by the owner. Only approved test inbox: `hello@artbyelyzaveta.shop`.
2. Export production business data, Auth, schema/functions/grants, Storage and configuration to git-ignored private local files. Hash and rehearse restoration into a separate local database before any production schema change. No current managed backup exists. Check drift against the three pending migrations.
3. Implement a bounded, authenticated email worker with retry classification, exponential backoff, stale-send quarantine, provider IDs, explicit reconciliation and admin visibility. Cover contact/commission notification recovery too. Configure a protected scheduler through existing infrastructure.
4. Run store-specific Stripe test payments, invoices, declines, cancellation/refund, idempotency and concurrency against isolated fixtures. Redirect every test notification to the approved inbox. Verify SMTP2GO acceptance/delivery and Auth mail, and inspect existing 17TRACK configuration/callback facilities. Preserve real business records.
5. Rehearse/apply compatible migrations after verified recovery, then deploy a tested branch to the existing protected Render service. Preserve a configuration and code rollback. Apply only the lowest essential hosting increase and record its cost.
6. Verify public Coming Soon and direct-link/API protection, private storefront/admin review, provider behaviour, health, logs, tests and responsive layout. Commit logical changes. Produce the A–J report and a separate future-launch checklist; do not execute launch steps.

Private configuration/backup artifacts are under `test-results/private-readiness/`, which is ignored by Git. Never print secret values or commit exported business data.
