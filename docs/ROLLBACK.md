# Rollback

## Live checkout — 30 August 2026

Current payment release: `ab4b2bf`. If payment correctness is uncertain, keep `PAYMENT_MODE=live` and set `ENABLE_LIVE_CHECKOUT=false` and `ENABLE_TEST_CHECKOUT=false`, then redeploy. Do not switch to demo: that would enable non-payment orders. Preserve both webhook signing secrets and both Stripe keys so existing transactions/refunds can still reconcile. Never erase orders, refund records, or audit history. Investigate and apply a forward fix before re-enabling checkout.

The sections below describe the historical demo cutover, not the current live-payment rollback procedure.

## Current demo release

The Supabase/demo-commerce cutover is developed and released directly from `main`. Record the ending release commit before deployment. The previous known-good baseline is `796903a`; prefer a normal forward revert commit or a Render redeploy of a known-good commit rather than rewriting history.

## If the deployed demo release has a problem

1. Keep `ENABLE_TEST_CHECKOUT=false`, `ENABLE_LIVE_CHECKOUT=false`, and search indexing disabled.
2. If order creation is suspect, temporarily change `PAYMENT_MODE` away from `demo` to disable checkout, then redeploy the last known-good commit or create a forward revert on `main`.
3. Do not delete Supabase data; preserve it for diagnosis.
4. Stripe is inactive in demo mode; do not enable or invoke it during rollback.
5. If email delivery is causing retries, remove/rotate the SMTP2GO key or deploy with non-live email delivery while preserving queued outbox rows.

## After eventual production merge

1. Immediately disable checkout flags if order/payment correctness is uncertain.
2. Redeploy the starting known-good commit recorded in the release report.
3. Keep Stripe webhooks enabled long enough to ingest already-created PaymentIntent/refund events; reconcile them before disabling anything.
4. Export affected Supabase order/event rows through a secure operator path without logging customer data.
5. If required, temporarily restore the prior Convex runtime commit and its existing cloud deployment/environment variables. The cloud Convex project is deliberately retained for this purpose.
6. Never roll back database migrations destructively on the live database. Use a new forward migration after diagnosis.

Do not use `git reset --hard`, delete the Supabase project, delete Convex cloud data, or erase customer records as part of rollback.
