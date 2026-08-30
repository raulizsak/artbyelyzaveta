# Payment verification — 30 August 2026

The owner authorized live checkout once verification succeeds, and removal of public demo/test wording when actually in live mode. No paid scheduler or hosting upgrade is authorized.

## Verified

- Removed two reproduced Stripe SDK IntegrationErrors: `confirm()` must not resupply `returnUrl` or `email` when the server sets the session return URL and customer email.
- Embedded card checkout with Stripe's test card completed successfully. Stripe session was Complete/Paid; Supabase order became Paid/Confirmed; the signed webhook produced one customer confirmation and one admin notification, both sent successfully.
- Stripe invoice was created once, marked Paid, attached to the original PaymentIntent, with zero amount remaining.
- Admin PDF download returned Stripe's original invoice PDF with the logo, ABN, order reference, artwork and correct total. Stripe distinguishes original invoice PDFs from paid receipt PDFs; the original invoice preserves its original amount-due wording.
- Admin Send Stripe Invoice returned successfully. Stripe does not deliver sandbox invoice emails, and the UI reports that limitation.
- Failed diagnostic sessions were expired unpaid in Stripe; their artwork reservations were released.
- The successful sandbox purchase was fully refunded through the admin workflow, and its artwork was restocked. Its audit history is preserved.
- Added automatic catalogue resynchronization after refund/restock and expiry, including retries when a Stripe catalogue update fails.
- Added bounded automatic status refresh to bridge the normal few-second webhook delay without claiming client-side payment success.
- Added mode-specific refund/cancellation routing and safe unpaid-session expiry before database restocking. Unknown or unresolved Stripe state blocks cancellation.
- Saved-card management remains test-only and is unavailable in live mode; embedded checkout can still accept payment details directly. Test saved cards must not be presented as live cards.

## Remaining release actions

- Deploy the automatic-refresh and mode-isolation changes and verify deployment health.
- Enable `PAYMENT_MODE=live`, `ENABLE_LIVE_CHECKOUT=true`, `ENABLE_TEST_CHECKOUT=false` using the existing live credentials.
- Verify live product/checkout/account wording and load the embedded live form without submitting a charge; close any validation-only live session through the admin cancellation flow.
- Do not claim a real live charge was tested unless a separately agreed live transaction actually occurs.
- Australia Post automatic carrier polling still requires valid carrier credentials; retain the existing free scheduler and manual delivery fallback.
