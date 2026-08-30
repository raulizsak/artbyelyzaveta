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

## Live release

- Code release `ab4b2bf` deployed successfully. Live configuration deployment `dep-da9qn44s728c73ei3gsg` became Live at 04:05:31 UTC on 30 August 2026.
- Enabled `PAYMENT_MODE=live`, `ENABLE_LIVE_CHECKOUT=true`, `ENABLE_TEST_CHECKOUT=false` using the existing live credentials. No plan or paid scheduler was added.
- Live product and checkout wording contains no demo/test messaging. The embedded card form displays the branded brush/palette Pay button and Stripe security note.
- Live Collection quote: artwork $1,370, WELCOME10 discount $137, shipping $0, total $1,233. Live Shipping quote: the same artwork discount plus undiscounted $30 shipping, total $1,263. Stripe's embedded form displayed exactly A$1,263.
- Verification-only live order `ABE-2026-897635CD9F` was cancelled through the admin workflow without entering card details or submitting payment. The safeguard closes the Stripe session before permitting database cancellation/restocking.
- 86 unit tests, lint, TypeScript, and production build passed for the payment release. No payment-related runtime error was observed during live verification; two destination-stream-closed messages occurred during navigation immediately after deployment.

## Remaining limitations

- No real live charge was submitted; a completed live card transaction and Stripe's live invoice-email delivery have not been end-to-end tested.
- Saved-card management is unavailable in live mode; this does not prevent embedded card checkout.
- Australia Post automatic carrier polling still requires valid carrier credentials; retain the existing free scheduler and manual delivery fallback.
- The broader production checklist still contains business review, backup/restore, and free-hosting reliability decisions. Payment enablement is not a claim that all those operational checks are complete.
