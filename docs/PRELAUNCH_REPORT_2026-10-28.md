# Art by Elyzaveta — pre-launch implementation and verification

28 October 2026. Repository: `https://github.com/raulizsak/artbyelyzaveta.git`. Work began on clean `main`, commit `2c17d948a884f2ee929dfc9dfb4222d9a33eb828`. Changes remain local and uncommitted. No push, production deploy, production database mutation, real payment, label purchase, dispatch, customer email, DNS change or paid service was performed.

**Launch assessment: NOT YET READY — BLOCKERS FOUND.** The storefront changes and isolated commerce checks are complete; access to the correct production providers, a proven recovery baseline, email operations and a tested promotion remain necessary.

## A. Shop redesign

The actual [Bluethumb catalogue](https://bluethumb.com.au/artworks) was inspected in a browser. Its compact browsing pattern informed the grid; no source, branding or exact visual identity was copied. Existing ivory, olive, serif typography, SmoothUI buttons/drawers/modals, Motion and Radix remain in use. No additional UI framework was installed.

| Viewport         | Columns | Horizontal gap                         |
| ---------------- | ------- | -------------------------------------- |
| Below 390px      | 1       | 14px                                   |
| 390–1023px       | 2       | 14px on phones, 24px on larger screens |
| 1024–1439px      | 3       | 24px                                   |
| 1440px and wider | 4       | 24px                                   |

Desktop introduction spacing is 64px above, 12px after the eyebrow, 16px before the description and 40px before controls. Image containers are 260–340px on desktop, 220px in compact phone columns and 280px below 390px. At 1440×900 the first image row fits below the heading and controls. One listing retains its normal column width.

Cards use contained photographs, fixed containers, responsive thumbnail/card WebP variants with actual stored pixel widths, eager/high-priority first-row images, lazy subsequent images, whole-card links, visible availability, AUD prices, real dimensions/medium and framing when recorded. Private original masters remain private; existing large gallery variants remain available. No real artwork metadata or source image was changed.

**Orientation root cause:** the former select displayed a fixed Landscape value without filtering. Orientation now filters the painting's physical width/height, with stored orientation as a fallback when measurements are unavailable. Room photograph proportions do not determine artwork orientation. The editor keeps dimensions and orientation consistent.

Availability, orientation, search, sort and progressive page are validated in the URL. Browser Back, refresh, clear, no-results and counts work together; search accepts Enter and a touch button. Sorting has stable tie-breaks. The mobile drawer uses existing SmoothUI controls. Initial rendering shows at most 24 cards; “Show more” adds 24 and persists the page in the URL. Isolated catalogues of 5, 20 and 100 records were exercised. The server still retrieves the eligible catalogue before client filtering; server pagination is the next step before exceeding the Supabase response cap or materially increasing payload size.

## B. Skeleton loading

All **35 page route patterns** have explicit `loading.tsx` files. Next's automatic boundaries display them only while a segment is pending. Static/cached pages can render immediately. Authentication inside the account/admin layouts is separately wrapped in Suspense, because a sibling loading file does not cover its own layout's async work.

| Route                         | Skeleton/content coverage                                     |
| ----------------------------- | ------------------------------------------------------------- |
| `/`                           | Coming-soon brand, heading and signup                         |
| `/home`                       | Hero/editorial introduction and featured artwork              |
| `/shop`                       | Filters, results and artwork grid                             |
| `/shop/[slug]`                | Main photograph, thumbnails, details and purchase controls    |
| `/about`                      | Editorial image and text                                      |
| `/commissions`                | Introduction and enquiry form                                 |
| `/contact`                    | Introduction and contact form                                 |
| `/cart`                       | Bag items and totals; local-storage hydration                 |
| `/checkout`                   | Customer fields, delivery, summary and payment preparation    |
| `/order-confirmation`         | Order heading, items, totals and status                       |
| `/order-access`               | Private order-access form                                     |
| `/login`                      | Authentication form                                           |
| `/signup`                     | Authentication form                                           |
| `/forgot-password`            | Recovery form                                                 |
| `/reset-password`             | Password form                                                 |
| `/preview`                    | Preview access form                                           |
| `/policies/[slug]`            | Policy heading and article text; all six current policy slugs |
| `/account`                    | Account summary                                               |
| `/account/addresses`          | Address records                                               |
| `/account/profile`            | Profile form                                                  |
| `/account/security`           | MFA/security form and asynchronous MFA state                  |
| `/account/payment-methods`    | Payment records; existing test-only feature remains gated     |
| `/account/returns`            | Return records                                                |
| `/account/orders`             | Order records                                                 |
| `/account/orders/[reference]` | Private order detail and items                                |
| `/admin`                      | Dashboard statistics, chart and recent records                |
| `/admin/paintings`            | Catalogue records                                             |
| `/admin/paintings/new`        | Artwork editor, photo area and fields                         |
| `/admin/paintings/[id]`       | Artwork editor, photo area and fields                         |
| `/admin/orders`               | Order table                                                   |
| `/admin/orders/[reference]`   | Order detail, items and fulfilment controls                   |
| `/admin/discounts`            | Discount table                                                |
| `/admin/discounts/new`        | Discount form                                                 |
| `/admin/discounts/[id]`       | Discount form                                                 |
| `/admin/returns`              | Return table                                                  |
| `/admin/subscribers`          | Subscriber records                                            |

Skeletons share warm tokens, screen-reader status text and `aria-busy`; decorative shapes are hidden from assistive technology. Reduced-motion disables shimmer/hover movement. No artificial loading delay was introduced. Artwork is visible as soon as the browser paints it, including before hydration; failed images expose an honest fallback. Quote, newsletter, auth/MFA, Supabase requests, Stripe script loading and payment preparation have bounded pending/error handling. Stripe uses its documented side-effect-free loader and loads only for explicitly enabled, valid-key checkout; fraud signals were not disabled. The Stripe Elements timeout links to authoritative order status rather than assuming payment failed. Existing confirmation refresh remains server-authoritative.

## C. Demo cleanup

- Missing or invalid payment configuration now means **disabled**. Demo requires an explicit local opt-in and is refused in production. Test/live keys and enable flags remain separate.
- The catalogue fixture is explicitly opt-in outside production. A production backend outage produces an error instead of sample paintings.
- Public catalogue queries explicitly exclude drafts/unpublished/archived works even when the visitor is an authenticated admin.
- Dashboard query errors no longer masquerade as zero statistics. An unrelated hardcoded fallback artwork image was removed.
- An unavailable room-preview button is hidden when no room photograph exists. Admin search accurately describes its existing order-search scope.
- Unfinished saved-card functionality is hidden from normal live/disabled account navigation; its existing test-only page/API gates remain.
- Historical demo order/audit data and isolated seed/test fixtures are retained and labelled. No genuine records were deleted or relabelled. Existing demo API code remains gated for local regression coverage.

## D. E-commerce verification

“Local database” below means the actual disposable Supabase Docker stack, real Auth/TOTP, database transactions and Storage. “Provider boundary” means mocked/normalised input without contacting Stripe, SMTP2GO or 17TRACK. These are distinct from production verification.

| Area              | Executed evidence and repair                                                                                                                                                                                                                                                                                                                                                                                           | Remaining external verification                                                                                                                                                                                                                                                                      |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Add/Edit Painting | Real AAL2 admin browser created a draft, entered dimensions/price/delivery, uploaded images, reordered and published; edited title/price/photos while retaining slug; archived and verified removal from Shop. Publish validation requires real dimensions, positive AUD price and a photograph.                                                                                                                       | Repeat in a backed-up production-like preview with actual store access.                                                                                                                                                                                                                              |
| Image management  | Real uploads produced private original plus public variants; two images produced ten metadata rows. Reorder, new-first image, removal and persistence passed. Upload retry IDs are stable; successful earlier uploads are retained on later failure. Delete removes catalogue metadata while preserving stored photographs for historic orders.                                                                        | Production bucket permissions, retention/storage usage and actual large-device upload limits.                                                                                                                                                                                                        |
| Inventory         | Real simultaneous independent database requests allowed exactly one buyer. Successful normalised payment sold the winner's work and queued two notifications. Timestamp alone no longer releases potentially payable reservations. Admin edits cannot overwrite a concurrent reservation or arbitrarily restock a sold work.                                                                                           | Real Stripe-session expiry/cancellation and late webhook delivery in the correct test account.                                                                                                                                                                                                       |
| Cart              | Add, drawer, persisted bag, gallery/detail navigation and hydration-safe cart/checkout passed.                                                                                                                                                                                                                                                                                                                         | Cross-browser/device testing beyond Chromium.                                                                                                                                                                                                                                                        |
| Stripe            | Embedded Checkout implementation retained. Mode gates, amount checks, signatures/event parsing, retries, duplicate and reordered events, pending/failed/paid states and invoice boundaries are covered by existing/extended tests. No success URL alone marks Paid. A card decline retains a retryable pending reservation; a verified terminal event releases it. Paid/refunded state cannot regress on a late event. | **No real-provider Stripe test payment was performed.** The connected Stripe account belongs to another business. Verify Shipping and Collection with the store's Stripe sandbox, signed webhooks, refresh, cancellation, refund and recovery before enabling sales.                                 |
| Discounts         | Real browser/RPC quote: artwork A$850.25 minus A$100 = A$750.25; Shipping A$25.50 yields A$775.75. Invalid code rejected. Server totals and redemption rules covered by database tests.                                                                                                                                                                                                                                | Correct test-account Stripe discount/invoice presentation and production codes.                                                                                                                                                                                                                      |
| Shipping          | Artwork-specific server-side price and address persistence validated. Fulfilment guards covered in database tests.                                                                                                                                                                                                                                                                                                     | No carrier-side address validation, parcel-rate quoting or label purchase capability was demonstrated.                                                                                                                                                                                               |
| Collection        | Shipping A$0 in browser and database; independent collection transitions covered; tracking/label registration is excluded. Email copy asks for personal collection arrangements instead of inventing an address.                                                                                                                                                                                                       | Actual collection instructions, recipient and owner operating workflow.                                                                                                                                                                                                                              |
| Australia Post    | Existing integration uses manually entered Australia Post tracking via 17TRACK carrier `1151`. No direct Australia Post account/API contract or label generator is configured in the audited code. Existing fixed painting shipping prices are preserved.                                                                                                                                                              | Business account/service approvals and any desired direct Australia Post capabilities remain unverified. No label was purchased.                                                                                                                                                                     |
| 17TRACK           | Carrier selection, raw-body signature checks, registration/duplicate/failure boundaries and database status/outbox transitions tested. New migration rejects older timestamps and prevents Delivered being regressed by later non-delivery events. Manual delivered fallback remains.                                                                                                                                  | Real test tracking registration, signed provider callback, current credentials, function deployment and customer/admin display of a provider-originated event.                                                                                                                                       |
| Order fulfilment  | Paid, preparing, shipped, delivered, collection, cancellation/refund and ownership guards exercised through database tests; existing account/admin detail pages visited with isolated authentication. Shared status presentation retained.                                                                                                                                                                             | Full provider-backed end-to-end fulfilment and return/refund paths. No real dispatch occurred.                                                                                                                                                                                                       |
| Emails            | Branded templates, escaping, correct status/totals/links, deduplicated queue events and mocked SMTP TLS/test-recipient/provider-failure tests pass. Logos use the existing PNG email asset. Contact/commission code stores enquiries before notifying the owner.                                                                                                                                                       | **No SMTP delivery/inbox test occurred.** Verify Auth mail, contact and commission owner notifications, any intended customer acknowledgement, all order notices and invoice attachments using a safe recipient. Scheduled retry/drain and ambiguous SMTP outcomes require the operational fix in H. |
| Invoices          | Existing PDF and Stripe invoice paths retained. Unit tests check amounts, shipping/discount line separation, mode/idempotency and unpaid/mismatch rejection. Anonymous private invoice request is denied. Existing ABN was preserved.                                                                                                                                                                                  | Store-account Stripe invoice creation/retrieval, actual emailed attachment/link and owner-approved business/GST/address fields.                                                                                                                                                                      |

The contact flow currently sends an owner notification, with a site acknowledgement; a separate customer acknowledgement email was not demonstrated and is not reported as implemented.

## E. Test evidence

| Command/check                                  | Final result                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run format`                               | PASS; repository formatting checked.                                                                                                                                                                                                                                                                         |
| `npm run lint`                                 | PASS.                                                                                                                                                                                                                                                                                                        |
| `npm run typecheck`                            | PASS.                                                                                                                                                                                                                                                                                                        |
| `npm test`                                     | PASS: 135 tests, 19 files, Vitest 5.0.5. Baseline was 115 tests.                                                                                                                                                                                                                                             |
| `npm run build`                                | PASS with Next.js 16.4.3. A second provider-disabled local production build was used for capacity/performance measurement.                                                                                                                                                                                   |
| `npx supabase test db --local`                 | PASS: 135 assertions across commerce, demo commerce, pre-launch integrity, RLS and tracking files.                                                                                                                                                                                                           |
| `npm run test:e2e:db`                          | PASS: 3 real-local-database browser tests: admin artwork lifecycle; independent concurrent purchase transactions; anonymous/customer/AAL1 admin denial.                                                                                                                                                      |
| `npm run test:e2e`                             | PASS: 21 tests; 5 intentional project-specific skips; desktop and touch-mobile Chromium.                                                                                                                                                                                                                     |
| `node scripts/measure-prelaunch.mjs`           | PASS: 5/20/100 record rendering, 24→48 progressive cards and refresh persistence, desktop/mobile no overflow. Temporary records cleaned in `finally`. Final local audit found no QA paintings/users; ten known orphan QA image files from earlier runs were identified by their audit-owned IDs and removed. |
| `npm audit --audit-level=high`                 | PASS: zero known npm advisories after security updates, including development dependencies.                                                                                                                                                                                                                  |
| Local Supabase security/performance inspection | No warnings/errors in the local inspection; production advisors unavailable for this project.                                                                                                                                                                                                                |
| `git diff --check`                             | PASS.                                                                                                                                                                                                                                                                                                        |

Key added suites are `catalogue-filters`, `production-config`, `loading-coverage`, `email-transport`, `stripe-invoices`, `tests/e2e/prelaunch.spec.ts`, `tests/e2e-local/commerce.spec.ts` and `supabase/tests/prelaunch_commerce.sql`. Existing payment-panel, Stripe webhook, tracking, email template, ownership, checkout and invoice tests were retained.

The viewport matrix covers 320, 375, 390, 430, 768, 1024, 1440 and 1920px. Browser checks include touch filtering/search, keyboard/Enter, navigation and history, no horizontal overflow, broken images, unavailable endpoints and reduced motion. Every route pattern has a loading-coverage assertion; public pages and existing protected routes were visited through the browser suites. Successful password-reset delivery, live signup mail, all provider forms and every production button have **not** been established by that route visitation. This is not a complete screen-reader/axe audit or a penetration test.

Production-build lab measurement with 100 synthetic artworks: desktop 1440px LCP 212ms; mobile 390px, 1.6Mbps download, 150ms requested latency and 4× CPU LCP **1904ms**, down from **4012ms** before removing hydration-gated artwork visibility and prioritising first-row images. Both runs recorded CLS **0** and no horizontal overflow. Sample interaction durations were 16ms desktop and 24–32ms mobile. The mobile resource sample was about 1.41MB. Navigation TTFB was local (~10ms), so this does not simulate Render cold start or real Australia-to-host/database latency. These are single paired lab runs, not Lighthouse scores, repeat-run medians or field INP. See [measurements](prelaunch-evidence/performance.json) and [before-image-fix measurement](prelaunch-evidence/performance-before-image-priority.json).

The first cold, six-worker storefront rerun hit its 30-second overall checkout-test limit twice. The checkout passed alone; the final full suite passed with two browser workers and a 60-second overall test budget. Application request timeouts were retained. Two added payment-panel tests prove an unresolved Stripe script load recovers at 20 seconds and disabled checkout does not load Stripe. Tests never substitute a payment success for a provider response.

![Shop at 1440px, isolated single-artwork fixture](<C:/Users/PC/Documents/ChatGPT/Art by Elyzaveta/docs/prelaunch-evidence/shop-1440.png>)

[Phone screenshot, 390px](prelaunch-evidence/shop-390.png) · [Twenty-artwork capacity screenshot](prelaunch-evidence/shop-20-artworks-desktop.png) · [Actual local admin edit](prelaunch-evidence/admin-edited-local.png)

Screenshots and machine-readable measurements live in `docs/prelaunch-evidence/`. `shop-20-artworks-desktop.png` and `shop-100-artworks-*.png` deliberately show synthetic local QA listings using existing artwork photography; they are capacity evidence, not a real catalogue. `admin-edited-local.png` shows an isolated local artwork editor. The single-real-fixture viewport screenshots demonstrate card sizing without filling the desktop width.

Manual production inspection confirmed HTTPS, the existing Coming Soon root and the password-protected `/shop` preview gate. Private production journeys could not be inspected without that access. Render reported baseline `2c17d94` live, no failed/restart events in the sampled seven-day window. Older malformed Server Action requests appeared in sampled logs; they are not evidence that all customer paths are healthy.

## F. Files changed

The exact repository-relative added/modified paths at the final check are listed below. Existing formatting was normalised so `npm run format` passes; several files have only whitespace/line-ending changes. No dependencies were added for a new product capability. Security updates changed existing runtime/test dependencies and the lockfile. No `.env.local`, artwork source, customer data or production secret file was edited. Next 16.4 regenerated its AGENTS.md heading; the generated instruction block is preserved.

```text
.env.example
.prettierignore
AGENTS.md
README.md
app/about/loading.tsx
app/about/page.tsx
app/account/addresses/loading.tsx
app/account/layout.tsx
app/account/loading.tsx
app/account/orders/[reference]/loading.tsx
app/account/orders/[reference]/page.tsx
app/account/orders/loading.tsx
app/account/payment-methods/loading.tsx
app/account/profile/loading.tsx
app/account/returns/loading.tsx
app/account/security/loading.tsx
app/account/security/page.tsx
app/admin/discounts/[id]/loading.tsx
app/admin/discounts/[id]/page.tsx
app/admin/discounts/loading.tsx
app/admin/discounts/new/loading.tsx
app/admin/discounts/page.tsx
app/admin/layout.tsx
app/admin/loading.tsx
app/admin/orders/[reference]/loading.tsx
app/admin/orders/[reference]/page.tsx
app/admin/orders/loading.tsx
app/admin/page.tsx
app/admin/paintings/[id]/loading.tsx
app/admin/paintings/[id]/page.tsx
app/admin/paintings/loading.tsx
app/admin/paintings/new/loading.tsx
app/admin/returns/loading.tsx
app/admin/subscribers/loading.tsx
app/api/admin/discounts/[id]/route.ts
app/api/admin/discounts/route.ts
app/api/admin/orders/[id]/route.ts
app/api/admin/paintings/[id]/media/route.ts
app/api/admin/paintings/[id]/route.ts
app/api/admin/paintings/route.ts
app/api/checkout/quote/route.ts
app/api/checkout/session/route.ts
app/api/health/route.ts
app/cart/loading.tsx
app/cart/page.tsx
app/checkout/loading.tsx
app/checkout/page.tsx
app/commissions/loading.tsx
app/commissions/page.tsx
app/contact/loading.tsx
app/contact/page.tsx
app/forgot-password/loading.tsx
app/forgot-password/page.tsx
app/globals.css
app/home/loading.tsx
app/loading.tsx
app/login/loading.tsx
app/login/page.tsx
app/order-access/loading.tsx
app/order-confirmation/loading.tsx
app/order-confirmation/page.tsx
app/policies/[slug]/loading.tsx
app/policies/[slug]/page.tsx
app/preview/loading.tsx
app/preview/page.tsx
app/reset-password/loading.tsx
app/reset-password/page.tsx
app/robots.ts
app/shop/[slug]/loading.tsx
app/shop/[slug]/page.tsx
app/shop/loading.tsx
app/shop/page.tsx
app/signup/loading.tsx
app/signup/page.tsx
components/account-navigation.tsx
components/admin-order-actions.tsx
components/artwork-image.tsx
components/auth-form.tsx
components/cart-page-client.tsx
components/cart-provider.tsx
components/checkout-client.tsx
components/coming-soon-signup.tsx
components/discount-editor.tsx
components/mfa-manager.tsx
components/page-skeletons.tsx
components/painting-card.tsx
components/painting-editor.tsx
components/payment-panel.tsx
components/product-gallery.tsx
components/shop-catalogue.tsx
components/ui/skeleton.tsx
docs/OPERATIONS.md
docs/PRELAUNCH_PLAN_2026-10-28.md
docs/PRELAUNCH_REPORT_2026-10-28.md
docs/ROLLBACK.md
docs/prelaunch-evidence/admin-edited-local.png
docs/prelaunch-evidence/performance-before-image-priority.json
docs/prelaunch-evidence/performance.json
docs/prelaunch-evidence/shop-100-artworks-desktop.png
docs/prelaunch-evidence/shop-100-artworks-mobile.png
docs/prelaunch-evidence/shop-1024.png
docs/prelaunch-evidence/shop-1440.png
docs/prelaunch-evidence/shop-1920.png
docs/prelaunch-evidence/shop-20-artworks-desktop.png
docs/prelaunch-evidence/shop-320.png
docs/prelaunch-evidence/shop-375.png
docs/prelaunch-evidence/shop-390.png
docs/prelaunch-evidence/shop-430.png
docs/prelaunch-evidence/shop-768.png
lib/auth/authorization.ts
lib/catalog-data.ts
lib/catalog-fixture.ts
lib/catalog.ts
lib/catalogue-filters.ts
lib/checkout.ts
lib/date-time.ts
lib/discounts/admin.ts
lib/discounts/quote.ts
lib/email/order-template.ts
lib/email/smtp2go.ts
lib/env.ts
lib/fetch-with-timeout.ts
lib/invoice-pdf.ts
lib/painting-admin.ts
lib/presentation.ts
lib/preview.ts
lib/site.ts
lib/stripe/catalog.ts
lib/stripe/discounts.ts
lib/stripe/server.ts
lib/supabase/admin.ts
lib/supabase/client.ts
lib/supabase/database.types.ts
lib/supabase/server.ts
lib/tracking/registration.ts
next.config.ts
package-lock.json
package.json
playwright.config.ts
playwright.database.config.ts
proxy.ts
scripts/local-prelaunch.mjs
scripts/local-supabase.cjs
scripts/measure-prelaunch.mjs
supabase/functions/email-outbox/index.ts
supabase/functions/tracking-webhook/index.ts
supabase/functions/tracking-webhook/seventeen-track.ts
supabase/migrations/20261028002128_prelaunch_inventory_integrity.sql
supabase/migrations/20261028004119_prelaunch_media_access.sql
supabase/migrations/20261028005325_prelaunch_tracking_event_order.sql
supabase/templates/confirmation.html
supabase/templates/recovery.html
supabase/tests/commerce.sql
supabase/tests/prelaunch_commerce.sql
supabase/tests/rls.sql
supabase/tests/tracking.sql
tests/catalogue-filters.test.ts
tests/e2e-local/commerce.spec.ts
tests/e2e/buyer-path.spec.ts
tests/e2e/prelaunch.spec.ts
tests/email-template.test.ts
tests/email-transport.test.ts
tests/loading-coverage.test.ts
tests/payment-panel.test.tsx
tests/preview.test.ts
tests/production-config.test.ts
tests/stripe-invoices.test.ts
tests/tracking-17track.test.ts
vitest.config.ts
```

Formatting/line-ending-only changes (content compared after Prettier formatting):

`README.md`, `app/account/orders/[reference]/page.tsx`, `app/admin/discounts/[id]/page.tsx`, `app/admin/discounts/page.tsx`, `app/admin/orders/[reference]/page.tsx`, `app/api/admin/discounts/[id]/route.ts`, `app/api/admin/discounts/route.ts`, `app/api/admin/orders/[id]/route.ts`, `components/admin-order-actions.tsx`, `components/discount-editor.tsx`, `docs/OPERATIONS.md`, `docs/ROLLBACK.md`, `lib/checkout.ts`, `lib/date-time.ts`, `lib/discounts/admin.ts`, `lib/discounts/quote.ts`, `lib/invoice-pdf.ts`, `lib/presentation.ts`, `lib/stripe/catalog.ts`, `lib/stripe/discounts.ts`, `lib/supabase/database.types.ts`, `lib/tracking/registration.ts`, `supabase/functions/email-outbox/index.ts`, `supabase/functions/tracking-webhook/index.ts`, `supabase/functions/tracking-webhook/seventeen-track.ts`, `tests/tracking-17track.test.ts`.

## G. Database and infrastructure changes

Three forward migrations were created and their SQL applied **only to local Supabase**, without resetting the existing stack. Production migration history/drift was not accessible; local direct SQL application does not establish a production migration record.

1. `20261028002128_prelaunch_inventory_integrity.sql`: reservation retention, retryable card declines, final-state/event idempotency and late success ownership checks. Existing function signatures/grants preserved; expected source blocks are asserted before replacement.
2. `20261028004119_prelaunch_media_access.sql`: verified AAL2 admin-only listing of public artwork storage objects, required for safe deterministic upserts. Public and customer enumeration remain denied; private masters stay protected.
3. `20261028005325_prelaunch_tracking_event_order.sql`: reject stale tracking updates and preserve Delivered. Existing eligibility/auth/notification path preserved.

No tables or columns were added. No production migration, storage deletion, new provider account, DNS record, hosting plan, scheduler, secret rotation or paid infrastructure change was made.

Configuration/code changes: `.env.example` now defaults to disabled payments and documents explicit local fixture/demo flags. Production must still set the existing test/live keys and enable gates deliberately. Supabase clients have bounded fetch timeouts. The proxy now persists refreshed protected-route session cookies while retaining page/API authorisation and private caching. `/api/health` is a no-store, bounded database check returning 200/503 without private details. It is **not yet configured as Render's health-check path**.

Security dependencies: Next 16.3.1→16.4.3, Nodemailer 9.0.5→10.2.1, Zod 4.4.3→4.6.7, Sharp 0.35.3→0.35.5 and vulnerable transitive packages were patched; Vitest 3.2.4→5.0.5, matching Next lint config and Node 22 types were installed. Node minimum is now 22.12.0, matching the test-runner requirement; local runtime was 22.22.3. Current Next bundled docs, [Nodemailer changelog](https://github.com/nodemailer/nodemailer/blob/master/CHANGELOG.md) and [Vitest migration requirements](https://vitest.dev/guide/migration/) were checked. The initial npm production audit reported eight vulnerable packages, including two critical; the final full audit is clean. The current deployed baseline has not received these patches.

Render inspection: Free web service `srv-da3sfpe1egvs73ap5in0`, Singapore, same repository/main, automatic main deployments, previews disabled, health path empty. Current environment values could not be verified using the available connector. Supabase production project `fhxgcvdwvagqnxgydyca` was denied by the connected account; unrelated projects/accounts were not substituted. The connected Stripe account was unrelated to this store and was not changed.

Read-only DNS inspection: MX pointed to Google; root TXT returned Google verification, with no root SPF observed in that response. DMARC was `p=quarantine`, relaxed alignment. SMTP2GO DKIM selectors/return-path and sender verification were not available. This does not establish whether aligned DKIM works; actual delivery and authentication headers still need testing. No DNS was changed.

SEO: canonical fallback is `https://artbyelyzaveta.shop`; public pages and artwork have canonicals, actual artwork Product data and social metadata. Structured data escapes `<`. Admin, account, auth, checkout, cart and private order pages are noindex; robots excludes private routes when indexing is enabled. Drafts are excluded. Existing Coming Soon, preview gate and search indexing-off settings remain until the launch gate is satisfied.

## H. Remaining issues

### Critical blockers

1. **Correct store access and provider-backed journeys are missing.** Connect the store's Supabase project and Stripe test account, and provide access to its protected preview through the normal tools. Verify Shipping and Collection payments, authentication mail, signed webhooks, pending/refresh/cancel/refund recovery, invoices and customer/admin views end to end. Available unrelated accounts were intentionally untouched. No real card is needed: use the store's isolated Stripe sandbox and controlled recipients.
2. **Production recovery and migration rehearsal are unverified.** Obtain a recoverable backup including private originals and relevant secrets/configuration, prove restoration into an isolated environment, inspect migration drift, then apply and verify the three forward migrations there. Rehearse before production. Local testing alone cannot certify the inaccessible deployment's current schema or backup.
3. **Email delivery and unattended recovery are unverified.** Verify SMTP2GO sender/DKIM/return-path, inbox delivery and all required notices with a safe recipient. The existing outbox deduplicates normal events, but no scheduled drain was verified. Failed jobs require a later invocation, and a worker crash can strand `sending` rows. SMTP acceptance followed by database-ack failure is ambiguous; blindly resending can duplicate mail. Establish a protected scheduled drain, visible failed/stale-job monitoring and a provider-ID reconciliation/manual recovery policy. Contact/commission failed notifications also need an operating retry path. Queue deduplication is not a proof of exactly-once external email delivery.
4. **Production has not received the security patches or new application changes.** Use a tested preview/staging release first, verify provider configuration and runtime memory, set `/api/health`, verify webhook reachability and recovery, then promote the reviewed release. Do not push this work to auto-deploying main before that gate. Current source patches do not secure an unchanged deployed baseline.
5. **Public launch remains intentionally closed.** Coming Soon, the preview password gate and indexing-off were observed/retained. Resolve the previous blockers before opening `/home`/Shop to the public and enabling indexing. Confirm actual business/invoice/policy details and collection instructions with the owner. The existing ABN `19 794 901 095` matches the retrieved [official registry entry](https://abr.business.gov.au/ABN/View?id=19794901095) (cached extract dated 17 August 2026); current legal/GST approval and invoice address were not established.

### Important but non-blocking

- [Render Free](https://render.com/docs/free) spins down after 15 idle minutes and can take about a minute to resume. It is unsuitable for predictable checkout/webhook responsiveness without an explicit availability decision. No plan was upgraded. Supabase's production plan/pausing/backup availability also requires confirmation; local success does not resolve it.
- The throttled local mobile LCP improved to 1.90s, but ~1.41MB of sampled resources and real hosting/database latency still deserve monitoring. No field INP or Render cold-start performance claim is made.
- Full axe/screen-reader testing, additional browser engines, genuine slow/provider-loss payment journeys and production field Core Web Vitals remain unverified. Recorded input-event durations are a small lab sample, not field INP.
- Media removal intentionally retains stored files. Define a conservative retention/cleanup policy that checks historical order references before deletion; monitor storage growth.
- Provider-originated tracking and all production admin operations have not been exercised. Local signature/transition tests do not prove credentials, webhook deployment or account approvals.

### Optional future improvements

- Server-side cursor pagination/search when catalogue payloads exceed practical limits or approach the default Supabase row cap; preserve stable sort/filter URLs.
- Automated multi-browser visual regressions, field performance/error monitoring and a formal accessibility audit.
- Direct Australia Post rating/labels only if the business obtains appropriate access and requests that capability.

## I. Launch decision

Keep the existing production release/gate in place while the critical blockers are resolved. The rollback baseline is `2c17d948a884f2ee929dfc9dfb4222d9a33eb828`; reverting application code must preserve all genuine orders, events, photos and notification records. Disable checkout with its existing enable flags during payment uncertainty, and reconcile provider state before restocking. Database migration rollback requires a tested recovery/forward repair, never deletion of real commerce data.

The concrete remaining work is correct store access, safe provider-backed end-to-end tests, recoverable backup/restore rehearsal, controlled migration/deployment, dependable email recovery and owner-approved launch configuration. No genuine financial or shipping operation is needed to verify these.

**NOT YET READY — BLOCKERS FOUND**
