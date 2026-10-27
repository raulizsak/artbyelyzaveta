# Operations

> Current payment verification and limitations are recorded in [Payment verification — 30 August 2026](PAYMENT_VERIFICATION_2026-08-30.md).

## Environments and cost boundary

- Supabase project: `art-by-elyzaveta` (`fhxgcvdwvagqnxgydyca`), Sydney `ap-southeast-2`, Free.
- Render: existing Free web service and `artbyelyzaveta.shop` domain.
- Payments: `PAYMENT_MODE=live`, `ENABLE_LIVE_CHECKOUT=true`, `ENABLE_TEST_CHECKOUT=false`. Embedded Stripe checkout accepts real payments; the coming-soon homepage remains unchanged.
- Email: live-recipient mode through the existing SMTP2GO account once its API/SMTP credentials are configured.
- The owner authorized live checkout. No paid scheduler, hosting upgrade, or operator-submitted real charge is authorized.

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

## Historical demo commerce mode

The former demo checkout called the service-only `create_demo_order` RPC. It validated the painting and authoritative price, atomically reserved the one-of-one work, created order/items/timeline/outbox records, marked the order paid and confirmed, and labelled it `is_demo=true`. No Stripe payment occurred. This endpoint is disabled in live mode; historical demo records remain labelled truthfully.

Historical demo cancellation/refund uses the database-only demo RPC and can restock only when explicitly selected. `Reset demo order` is restricted to an AAL2 admin and preserves audit/order history. Stripe orders instead use their stored test/live mode, signed webhooks, and Stripe-generated invoices.

## Email delivery and outbox

Application and webhook transactions insert deduplicated `email_outbox` rows. The Render server claims a bounded batch atomically, renders the relevant customer/admin template, sends through the existing SMTP2GO SMTP user with STARTTLS, and records delivery state/provider ID. Contact and commission notifications use the same SMTP transport after their enquiry rows are safely stored.

Application order notifications use:

```text
EMAIL_DELIVERY_MODE=live
STORE_NOTIFICATION_EMAIL=hello@artbyelyzaveta.shop
```

Configure `SMTP2GO_SMTP_HOST`, `SMTP2GO_SMTP_PORT`, `SMTP2GO_SMTP_USER`, `SMTP2GO_SMTP_PASSWORD`, and the verified `EMAIL_FROM` sender in Render before testing application email. The Render web service uses SMTP2GO's implicit-TLS port `443`; this avoids the SMTP ports restricted on Render Free while keeping transport encryption enabled. Verify order confirmation, admin new order, tracking, delay, commission update, invoice, cancellation, refund, return, contact, and commission delivery. Supabase Auth SMTP is configured separately in Auth settings with the same SMTP user and verified sender/domain.

An `email-outbox` Edge Function is deployed as a dormant, custom-authenticated fallback. It is not used by the current Render SMTP path and has no SMTP2GO API key configured.

## Australia Post tracking through 17TRACK

Australia Post shipments use 17TRACK API v2.4 with explicit carrier code `1151`; the website does not require an Australia Post Shipping & Tracking API contract. When an AAL2 administrator enters a tracking number and marks a non-demo Shipping order as Shipped, the Render server registers only that tracking number and carrier with 17TRACK. Collection and demo orders are rejected before any provider call. Repeated saves use a database claim and 17TRACK's already-registered response as idempotency guards.

17TRACK posts complete tracking updates to:

```text
https://fhxgcvdwvagqnxgydyca.supabase.co/functions/v1/tracking-webhook
```

The public Edge Function preserves the raw body and verifies the `sign` header as the hexadecimal SHA-256 of `raw_body + "/" + TRACK17_API_KEY`. It accepts only current Australia Post tracking numbers already associated with eligible Shipping orders. Structured `latest_status.status = "Delivered"` enters the existing atomic Delivered transition; the existing `email_outbox` dedupe key remains the final exactly-once mail guard. A successful transition calls the protected Render email-outbox endpoint so SMTP2GO delivery is not left queued.

Required secret placement:

- Render: `TRACK17_API_KEY`, plus the existing `EMAIL_OUTBOX_TRIGGER_SECRET`.
- Supabase Edge Functions: `TRACK17_API_KEY`, `RENDER_EMAIL_OUTBOX_URL`, and `RENDER_EMAIL_OUTBOX_SECRET`.

The two outbox secret variables above contain the same secret under environment-specific names. Never use a `NEXT_PUBLIC_` prefix. The retired `AUSTRALIA_POST_API_KEY`, `AUSTRALIA_POST_API_PASSWORD`, `AUSTRALIA_POST_ACCOUNT_NUMBER`, and `TRACKING_CRON_SECRET` variables are not used. The former hourly `art-by-elyzaveta-tracking-hourly` pg_cron job and `tracking-check` function are retired after the signed webhook endpoint is verified.

If 17TRACK is unavailable, save the order as Shipped and retry the same update later. The admin page shows a safe registration error. The existing **Mark delivered** control remains the manual fallback and uses the same atomic timeline/outbox path.

## Auth URLs

Allowed site/redirect URLs must include the exact HTTPS production domain and local development callback:

- `https://artbyelyzaveta.shop`
- `https://artbyelyzaveta.shop/auth/callback`
- `http://localhost:3000/auth/callback`

Password-reset links return to `/reset-password`. Recheck redirects after any domain or `www` decision.

## Order operations

- Fulfillment, tracking, customer status, internal notes, commission stage/ETA, returns, cancellation, and refund actions require admin AAL2.
- Historical demo cancellations/refunds never call Stripe. Stripe cancellations/refunds use the order's stored mode even after the active checkout mode changes. Unpaid sessions must be confirmed expired before restocking.
- Restocking a one-of-one painting happens only after a full successful refund and an explicit restock choice.
- Only AAL2 admins can use `Reset demo order`, and only when `is_demo=true`.
- Shipped/delivered purchases use the return workflow rather than cancellation.
- Audit and timeline rows are append-only from the application.

## Routine checks

Before each release run formatting, lint, typecheck, unit tests, pgTAP, Playwright, and a production build. Review Supabase security/performance advisors after DDL changes. Review Render build/runtime logs and memory after deployment without changing the Free plan.
