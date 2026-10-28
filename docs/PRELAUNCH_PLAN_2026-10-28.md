# Pre-launch implementation plan — 28 October 2026

## Baseline and findings

- Repository: `https://github.com/raulizsak/artbyelyzaveta`, clean `main`, baseline `2c17d948a884f2ee929dfc9dfb4222d9a33eb828`.
- Next.js 16.3 / React 19 / Tailwind 4; SmoothUI, Motion, Radix and Vaul already installed. Supabase provides database, auth and storage. Embedded Stripe, SMTP2GO and signed 17TRACK delivery updates already exist.
- Orientation is an uncontrolled select fixed to Landscape; it does not filter. Catalogue state is not preserved in the URL. Cards use large main images and oversized layout rules. Route loading is three generic rectangles.
- Local environment contains only legacy Convex configuration. Production Supabase project `fhxgcvdwvagqnxgydyca` is outside the connected Supabase account; the project read is denied. Do not substitute another database.
- Render serves baseline `2c17d94`, Free plan, Singapore, automatic deployment from `main`, previews disabled, no health-check path. No recent failure/restart events returned in the seven-day query.
- Baseline: 115 Vitest tests passed. Provider and database verification remains separate from local tests.

## Implementation

1. Catalogue: change `components/shop-catalogue.tsx`, `components/painting-card.tsx`, `app/shop/page.tsx`, `app/globals.css`; add a pure `lib/catalogue-filters.ts` module. Use URL filters/search/sort, 24-item progressive loading, explicit orientation semantics, compact 1/2/3/4-column grid, whole-card links and contained image variants.
2. Loading: add shared `components/page-skeletons.tsx`; replace `app/loading.tsx`; add segment loading files for all public, account and admin route families. Use existing skeleton tokens, pending interaction states and reduced motion. Preserve auth boundaries.
3. Audit/repair: inspect painting editor/media APIs, payment/session lifecycle, tracking, email outbox, public fixtures, SEO and security. Add focused tests for any repairs. Keep historical demo records truthful and isolated; fail closed when production configuration is missing.
4. Verification: formatting, ESLint, TypeScript, Vitest, production build; Playwright customer flows, complete route inventory, viewport matrix, filtering, keyboard, gallery, failures and safe API denials. Run local database tests if Docker is available. Record unavailable provider/auth facilities explicitly.
5. Produce `docs/PRELAUNCH_REPORT_2026-10-28.md`, with route matrix, exact file changes, commands/results, integration evidence, blockers and launch decision.

## Database/integration scope

Prefer no schema change. If transactional integrity requires a database repair, prepare an additive forward migration and isolated tests; do not apply it to production without verification and backup. No real charge, shipping purchase, dispatch or customer test message. No new subscription or paid infrastructure.

## Deployment and rollback

Keep the current production release running while launch blockers remain. A push to `main` would auto-deploy; do not push unfinished or unverified changes. Use local production preview for this change set. Production promotion requires a tested recoverable database baseline, verified provider configuration and resolved launch blockers. Roll back application code to `2c17d94` through a normal deploy; preserve payment/tracking webhooks and all genuine data. For payment uncertainty use the existing checkout-disable flags, never switch production to demo mode.
