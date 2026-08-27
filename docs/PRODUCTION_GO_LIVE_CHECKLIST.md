# Production go-live checklist

Live Stripe payments remain out of scope until this checklist is reviewed and separately approved.

## Hosting and domain

- [ ] Render production build and start command pass from the approved commit.
- [ ] Health check and `https://artbyelyzaveta.shop` work over TLS, including the chosen `www` redirect.
- [ ] Render runtime logs show no repeated errors or multi-megabyte image transformations.
- [ ] Gallery/room-preview exercise does not reproduce the prior memory-heavy request pattern.
- [ ] Decide whether Render Free cold starts/resources are acceptable for paying customers; do not upgrade without approval.

## Supabase

- [x] Production project remains in Lisa's organization, Sydney, with current migrations applied and generated types refreshed.
- [x] Real Convex counts/files/timestamps/slugs are verified in Supabase; raw temporary export remains outside Git and can be securely removed when rollback retention no longer requires it.
- [x] All 82 pgTAP RLS/commerce/storage/demo-commerce tests pass from a clean reset.
- [x] Security advisor has no unaccepted critical/error finding; the one warning is the Pro-only leaked-password feature while the project intentionally remains Free.
- [x] Performance advisor has 0 errors/warnings; 28 unused-index info findings are documented and retained until real query statistics exist.
- [ ] Decide whether Free pausing, quotas, support, and lack of production-grade backups are acceptable; select a paid plan only after approval.
- [ ] Establish a tested database backup/export and restore procedure before accepting money.

## Authentication and admin

- [ ] Production Site URL and redirect allowlist use the final HTTPS domain.
- [ ] SMTP2GO is configured for Supabase Auth; signup verification and password reset arrive correctly.
- [ ] Lisa's verified user ID is assigned the protected admin role.
- [ ] Lisa enrolls and verifies primary and backup TOTP factors.
- [ ] Customer denial, admin AAL1 denial, and admin AAL2 workflows are manually verified.
- [ ] Signup, verification, login, logout, reset, session persistence, protected account, and protected admin browser tests pass.

## Stripe and orders

- [x] Current deployment is explicitly `PAYMENT_MODE=demo`; it collects no card details and makes no Stripe API/payment/refund call.
- [x] Demo orders, refunds/cancellations, timeline events, email outbox entries, `DEMO` labels, and AAL2-only reset are database-backed.
- [ ] All Stripe test keys/webhook secrets are removed or clearly separated from live configuration.
- [ ] Create the live webhook only after approval, with the exact required events and HTTPS Edge Function URL.
- [ ] Run live-mode configuration checks without making a real charge until an approved low-value end-to-end transaction plan exists.
- [ ] Guest and account checkout, sold/reserved conflicts, concurrent reservation, price tampering, success, failure, expiry, and release pass.
- [ ] Full/partial/excess/duplicate/failed refund scenarios pass; restock occurs only after explicit full successful refund.
- [ ] Human order references never authorize access; guest token expiry and cross-order denial pass.

## Storage, invoices, and privacy

- [ ] Public artwork variants and private masters are present with expected counts and bytes.
- [ ] Private inspiration, return evidence, and invoice cross-user/anonymous tests pass.
- [ ] Invoice legal fields, ABN/GST treatment, business address, numbering, and footer are approved by the business/accountant.
- [ ] Logs, URLs, Stripe metadata, analytics, and errors contain no address, phone, private explanation, secret, or stack trace.

## Email

- [x] SMTP2GO credentials authenticate and the final-domain sender delivered a real test message accepted for `hello@artbyelyzaveta.shop`.
- [x] Render SMTP2GO SMTP variables and Supabase Auth custom SMTP credentials are configured; none are committed.
- [ ] Test-recipient mode proves order confirmation, admin order, tracking, delay, commission, invoice, cancellation, refund, and return templates.
- [ ] Idempotency prevents duplicate customer/admin messages under webhook retries.
- [ ] Confirm application live-recipient delivery with a monitored demo order before any public launch.

## Store operations and legal

- [ ] Shipping/collection wording and any prices are approved; the app does not invent automatic rates.
- [ ] Terms, privacy, shipping, returns/refunds, commission, and cancellation policies are legally/business reviewed.
- [ ] Fulfillment, tracking, delay, commission ETA, cancellation, refund, invoice, and return runbooks are accepted by Lisa.
- [ ] Accessibility and mobile checks pass at 390×844, 393×852, 430×932, and desktop.
- [ ] Sitemap/robots/canonical metadata are reviewed; enable search indexing only at launch.

## Final release

- [ ] Formatting, lint, TypeScript, unit, pgTAP, full Playwright, and production build all pass on the exact ending commit.
- [ ] Ending commit is pushed and reviewed; worktree is clean.
- [ ] Exact rollback commit and operator are recorded.
- [ ] Costs are confirmed before any plan change.
- [ ] Explicit approval is given to enable live payments. The demo release already deploys from `main` behind the coming-soon homepage.
