# Art by Elyzaveta

Production-oriented ecommerce for original paintings and commissions. The application uses Next.js 16 on Render, Supabase PostgreSQL/Auth/Storage, Stripe Checkout Sessions with the embedded Payment Element, and SMTP2GO transactional email.

The migration is developed on `codex/supabase-commerce-migration`. Stripe remains in **TEST MODE**, search indexing remains disabled, and Render production `main` must not be changed until every go-live gate is approved.

## Architecture

- Next.js App Router, React, TypeScript, and Tailwind CSS on Render
- Supabase PostgreSQL with RLS, Auth with mandatory admin TOTP/AAL2, and Storage
- Stripe custom checkout in test mode with signed, idempotent webhook processing
- SMTP2GO delivery through the `email-outbox` Edge Function
- Pre-generated WebP artwork variants; no paid runtime image transformations
- Vitest, Playwright, and pgTAP security/commerce suites

No Clerk, Redis, paid Supabase branch, or live Stripe credential is used.

## Local setup

Requirements: Node.js 22+, Docker Desktop, and Git.

```bash
npm install
npm run supabase:start
```

Copy `.env.example` to `.env.local`. Use the local URL and publishable/secret values printed by `supabase:start`, keep `ENABLE_TEST_CHECKOUT=false` unless testing Stripe, then run:

```bash
npm run dev
```

Local Supabase uses ports `55430`–`55439` to avoid Windows-reserved `5432x` ranges. Mail is captured locally at the Mailpit URL printed by the CLI and is never delivered externally.

## Environment

`.env.example` is authoritative. Important boundaries:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` are browser-safe.
- `SUPABASE_SECRET_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SMTP2GO_API_KEY`, and `RATE_LIMIT_SECRET` are server-only.
- `ENABLE_TEST_CHECKOUT` enables only Stripe test checkout.
- `ENABLE_LIVE_CHECKOUT` must remain `false` until separate go-live approval.
- `EMAIL_DELIVERY_MODE=test` redirects application email to `EMAIL_TEST_RECIPIENT`.
- `ENABLE_SEARCH_INDEXING=false` keeps the migration environment out of search results.

Never commit `.env.local`, production exports, customer data, or private files.

## Database workflow

All schema and policy changes live in `supabase/migrations`. The safe fake fixtures are in `supabase/seed.sql`.

```bash
npm run supabase:reset
npm run test:db
npm run types:supabase
```

`supabase:reset` recreates the local database, applies every migration, and loads fake fixtures. `test:db` runs direct-token RLS/storage and atomic commerce pgTAP tests. `types:supabase` regenerates `lib/supabase/database.types.ts` from the local migrated schema. To regenerate from the cloud project after linking credentials:

```bash
npm run types:supabase -- --project-id=fhxgcvdwvagqnxgydyca
```

## Media and Convex migration

```bash
npm run media:optimize
npm run migrate:convex -- --export-dir=C:\path\to\unpacked-export
```

Both scripts are dry-run-safe. The Convex script requires `--execute` plus Supabase server credentials before it can write. Raw exports must stay outside the repository. The cloud Convex deployment is retained temporarily for rollback, even after its runtime package and provider are removed from the application.

## Verification

```bash
npm run format
npm run lint
npm run typecheck
npm run test
npm run test:db
npm run test:e2e
npm run build
```

The suites cover catalogue and input validation, direct RLS and storage access, admin AAL1/AAL2 boundaries, atomic one-of-one reservation, webhook/refund idempotency, guest-token rotation, price tampering, failed-payment release, responsive buyer flows, and rapid mobile gallery interaction.

## Deployment boundary

Render production auto-deploys `main`. Push and test the implementation branch first. Do not merge until Supabase migration verification, Auth/SMTP, Edge Functions, Stripe TEST webhook, authenticated browser tests, advisors, and the production build are all green.

Operational detail is in [Operations](docs/OPERATIONS.md), [Migration report](docs/MIGRATION_REPORT.md), [Rollback](docs/ROLLBACK.md), and the [Production go-live checklist](docs/PRODUCTION_GO_LIVE_CHECKLIST.md).
