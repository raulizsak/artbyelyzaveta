# Production go-live checklist

Live Stripe payments remain out of scope until this checklist is reviewed and separately approved.

## Hosting and domain

- [ ] Render production build and start command pass from the approved commit.
- [ ] Health check and `https://artbyelyzaveta.shop` work over TLS, including the chosen `www` redirect.
- [ ] Render runtime logs show no repeated errors or multi-megabyte image transformations.
- [ ] Gallery/room-preview exercise does not reproduce the prior memory-heavy request pattern.
- [ ] Decide whether Render Free cold starts/resources are acceptable for paying customers; do not upgrade without approval.

## Supabase

- [ ] Production project remains in Lisa's organization, Sydney, with current migrations recorded and generated types refreshed.
- [ ] Real Convex counts/files/timestamps/slugs are verified in Supabase; raw temporary export is securely removed when rollback retention no longer requires it.
- [ ] All 66 pgTAP RLS/commerce/storage tests pass from a clean reset.
- [ ] Security advisor has no unaccepted critical/error finding.
- [ ] Performance advisor findings are fixed or documented with a concrete reason.
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

- [ ] SMTP2GO sender/domain is verified for the final domain.
- [ ] Test-recipient mode proves order confirmation, admin order, tracking, delay, commission, invoice, cancellation, refund, and return templates.
- [ ] Idempotency prevents duplicate customer/admin messages under webhook retries.
- [ ] Switch application email to production delivery only after approval and a monitored test order.

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
- [ ] Explicit approval is given to merge `main` and enable live payments.
