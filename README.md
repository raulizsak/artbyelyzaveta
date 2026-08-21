# Art by Elyzaveta

A polished, responsive Phase 1 storefront for original paintings and custom commission enquiries. The project is intentionally in demo commerce mode: the full buyer journey works, but no payment details are requested, stored or transmitted.

## Stack

- Next.js App Router, React, TypeScript and Tailwind CSS
- Convex for the painting catalogue, contact enquiries and commission enquiries
- SmoothUI/shadcn primitives, Motion and Lucide icons
- Vitest and Playwright
- Render-ready dynamic Next.js service

## Local setup

Requirements: Node.js 22 or newer.

```bash
npm install
npx convex dev
npm run dev:next
```

The Convex CLI creates `.env.local` with `NEXT_PUBLIC_CONVEX_URL`. Seed the one-painting catalogue once:

```bash
npx convex run seed:seedPainting
```

Open `http://localhost:3000`.

## Environment variables

Copy `.env.example` for the documented variable names. Runtime needs:

- `NEXT_PUBLIC_CONVEX_URL`: the production Convex client URL.
- `NEXT_PUBLIC_SITE_URL`: the canonical public Render URL.

`CONVEX_DEPLOY_KEY` is a deployment secret for Convex CLI/CI and must never be exposed to the browser.

## Verification

```bash
npm run format
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

The Playwright suite verifies the desktop and mobile buyer journey, duplicate-safe cart, undo, room preview/lightbox, payment-free checkout, confirmation, and Convex-backed enquiry forms.

## Commerce boundary

`components/payment-panel.tsx` exports a replaceable `PaymentPanel` interface and the current `MockPaymentPanel`. Live payments, reservations, automated email, user accounts and an admin interface are deliberately deferred.

## Deployment

Render configuration:

- Service type: Web Service
- Region: Singapore
- Plan: Free
- Build command: `npm install && npm run build`
- Start command: `npm start`
- Health check: `/`

Create and seed a production Convex deployment first, then add the two public runtime environment variables to Render before deploying.
