# Art by Elyzaveta

Production-oriented ecommerce for original paintings and commissions. The application uses Next.js 16 on Render, Supabase PostgreSQL/Auth/Storage, a no-charge demo checkout, and SMTP2GO transactional email.

The Supabase cutover is on `main`. The public root is a premium coming-soon/signup page, while direct test routes remain available. `PAYMENT_MODE=demo` creates real, clearly labelled database orders without collecting card details or calling Stripe. Search indexing and live payments remain disabled.

## Architecture

- Next.js App Router, React, TypeScript, and Tailwind CSS on Render
- Supabase PostgreSQL with RLS, Auth with mandatory admin TOTP/AAL2, and Storage
- No-charge demo checkout with transactional order creation, demo refund/reset, and retained Stripe architecture for later approval
- SMTP2GO SMTP delivery from the Render server with a durable Supabase email outbox
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
- `SUPABASE_SECRET_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SMTP2GO_SMTP_USER`, `SMTP2GO_SMTP_PASSWORD`, and `RATE_LIMIT_SECRET` are server-only.
- `PAYMENT_MODE=demo` selects the current no-card, no-Stripe demo checkout.
- `ENABLE_TEST_CHECKOUT` is retained for a future separately approved Stripe test activation.
- `ENABLE_LIVE_CHECKOUT` must remain `false` until separate go-live approval.
- `EMAIL_DELIVERY_MODE=live` sends to the intended customer or `STORE_NOTIFICATION_EMAIL`; it requires valid SMTP2GO SMTP credentials.
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

Both scripts are dry-run-safe. The production import has completed and was count-verified; the command remains available for an idempotent recovery/import run with `--execute`. Raw exports stay outside the repository. The application no longer has a Convex runtime/package/source dependency, while the cloud Convex deployment is retained temporarily for rollback.

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

Render production auto-deploys `main`. Keep `PAYMENT_MODE=demo`, both Stripe checkout flags false, and search indexing disabled until the separate production go-live approval. The remaining external gates are tracked explicitly in the go-live checklist.

Operational detail is in [Operations](docs/OPERATIONS.md), [Migration report](docs/MIGRATION_REPORT.md), [Rollback](docs/ROLLBACK.md), and the [Production go-live checklist](docs/PRODUCTION_GO_LIVE_CHECKLIST.md).
