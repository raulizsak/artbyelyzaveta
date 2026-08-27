# Rollback

## Before production merge

No rollback is needed for the live storefront because `main` remains unchanged. Continue using the existing Render production deployment. The implementation branch can be abandoned without deleting the Supabase project or cloud Convex data.

## After a test-branch Render deployment

1. Disable `ENABLE_TEST_CHECKOUT` and keep `ENABLE_LIVE_CHECKOUT=false`.
2. Point Render back to the last known-good commit/branch or redeploy that commit.
3. Do not delete Supabase data; preserve it for diagnosis.
4. Disable the Stripe test webhook endpoint if it is causing repeated failures.
5. Keep SMTP delivery in test mode.

## After eventual production merge

1. Immediately disable checkout flags if order/payment correctness is uncertain.
2. Redeploy the starting known-good commit recorded in the release report.
3. Keep Stripe webhooks enabled long enough to ingest already-created PaymentIntent/refund events; reconcile them before disabling anything.
4. Export affected Supabase order/event rows through a secure operator path without logging customer data.
5. If required, temporarily restore the prior Convex runtime commit and its existing cloud deployment/environment variables. The cloud Convex project is deliberately retained for this purpose.
6. Never roll back database migrations destructively on the live database. Use a new forward migration after diagnosis.

Do not use `git reset --hard`, delete the Supabase project, delete Convex cloud data, or erase customer records as part of rollback.
