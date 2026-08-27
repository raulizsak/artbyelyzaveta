# Operations

## Environments and cost boundary

- Supabase project: `art-by-elyzaveta` (`fhxgcvdwvagqnxgydyca`), Sydney `ap-southeast-2`, Free.
- Render: existing Free web service and `artbyelyzaveta.shop` domain.
- Stripe: test mode only.
- Email: existing SMTP2GO allowance, initially forced to a test recipient.
- No paid branch, image transformation, hosting upgrade, or live payment is authorized.

Supabase Free can pause after low activity. Do not add keepalive traffic to defeat that limit. Reassess plan, backups, and support before real commerce launch.

## Local database

```bash
npm run supabase:start
npm run supabase:reset
npm run test:db
npm run types:supabase
```

The seed contains only fictional `.example.test` users and addresses. A reset is destructive only to the disposable local stack.

## Admin bootstrap and MFA

1. Lisa registers through `/signup` and verifies her email.
2. A trusted operator assigns `profiles.role = 'admin'` by verified `auth.users.id` using the postgres/service boundary. Never expose a public role-assignment endpoint and never trust `user_metadata.role`.
3. On next login, `/admin` redirects the admin to TOTP enrollment until a verified factor exists.
4. Every admin page and sensitive RPC requires `role = admin` and `aal2`.
5. Enroll a second TOTP factor on a separate trusted authenticator/device as the recovery factor. Store both authenticator backups securely; Supabase TOTP does not use traditional one-time recovery codes.
6. Test sign-out, AAL1 denial, TOTP challenge, AAL2 access, and factor removal before launch.

## Storage

- `artwork-public`: optimized variants; public read, admin AAL2 write.
- `artwork-originals`: private masters; admin AAL2 only.
- `commission-inspiration`: private; server-created upload paths and admin AAL2 read.
- `return-evidence`: private paths keyed by user and return request; owner upload/read and admin AAL2 read.
- `invoices`: private; owner or admin AAL2 access, with short-lived signed delivery where needed.

Future artwork processing happens in the admin browser: validate source dimensions/size, create deterministic WebP variants, and upload directly to Storage. Render must not proxy multi-megabyte masters or transform them per request.

## Stripe TEST mode

The application creates a server-priced reservation before a custom Checkout Session. The signed Edge Function webhook is authoritative for payment, sale, failure, expiry, setup intent, and refund state. `stripe_events` and per-request idempotency keys make replays safe.

Deploy the webhook with JWT verification disabled only because Stripe cannot supply a Supabase JWT and the function verifies Stripe's signature itself. Configure only test keys during this phase. Never put addresses, phone numbers, or return explanations in Stripe metadata; only internal IDs are sent.

## Email outbox

Application and webhook transactions insert deduplicated `email_outbox` rows. The `email-outbox` Edge Function claims a bounded batch atomically, renders the relevant customer/admin template, calls SMTP2GO, and records delivery state/provider ID.

Start with:

```text
EMAIL_DELIVERY_MODE=test
EMAIL_TEST_RECIPIENT=<controlled test inbox>
```

Verify order confirmation, admin new order, tracking, delay, commission update, invoice, cancellation, refund initiated/completed, and return templates before switching delivery mode. Supabase Auth SMTP must be configured separately in Auth settings with the same verified SMTP2GO sender/domain.

## Auth URLs

Allowed site/redirect URLs must include the exact HTTPS production domain and local development callback:

- `https://artbyelyzaveta.shop`
- `https://artbyelyzaveta.shop/auth/callback`
- `http://localhost:3000/auth/callback`

Password-reset links return to `/reset-password`. Recheck redirects after any domain or `www` decision.

## Order operations

- Fulfillment, tracking, customer status, internal notes, commission stage/ETA, returns, cancellation, and refund actions require admin AAL2.
- Paid cancellations issue a full Stripe test refund and wait for the signed webhook before reflecting success.
- Restocking a one-of-one painting happens only after a full successful refund and an explicit restock choice.
- Shipped/delivered purchases use the return workflow rather than cancellation.
- Audit and timeline rows are append-only from the application.

## Routine checks

Before each release run formatting, lint, typecheck, unit tests, pgTAP, Playwright, and a production build. Review Supabase security/performance advisors after DDL changes. Review Render build/runtime logs and memory after deployment without changing the Free plan.
