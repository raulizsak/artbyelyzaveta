# Convex to Supabase migration report

## Source inventory

The official Convex production export was created outside the repository and unpacked in a temporary local directory. No raw PII or private file is tracked by Git.

| Source                         | Records/files found | Destination                                                |
| ------------------------------ | ------------------: | ---------------------------------------------------------- |
| `paintings`                    |                   1 | `public.paintings` plus relational `painting_media`        |
| `contactEnquiries`             |                   0 | `public.contact_enquiries`                                 |
| `commissionEnquiries`          |                   3 | `public.commission_enquiries`                              |
| Commission inspiration storage |                   3 | private `commission-inspiration` bucket plus metadata rows |
| Optimized artwork variants     |                  20 | public `artwork-public` bucket plus metadata rows          |

The dry-run migration validates one painting, three commission enquiries, three private files, unique slugs, preserved statuses/timestamps, and the 20-item media manifest. It emits counts only and does not log enquiry PII.

## Destination schema

The schema, triggers, functions, RLS, policies, buckets, and seed are reproducible from committed migrations. Eight migrations have been applied to the connected Supabase project. The later migrations correct Stripe timeline idempotency, remove unnecessary public Storage enumeration, consolidate authenticated RLS policies, and cover every foreign key reported by the performance advisor.

## Cutover status

The real write/import must run only after action-time approval to retrieve a Supabase server secret and transmit the private Convex export/files to Lisa's project. After execution, record source/destination counts and representative non-PII checks here before removing the Convex package/source directory.

The existing cloud Convex project must remain intact as rollback protection. It is not to be deleted in this phase.

## Verification record

- Export/dry run: passed.
- Optimized media generation: passed.
- Fresh local migration plus fake seed: passed.
- pgTAP commerce/RLS/storage: 66/66 passed.
- Supabase Security Advisor: 0 errors, 0 warnings, 2 accepted informational findings. `rate_limit_events` and `stripe_events` intentionally have no client policy and are deny-all outside trusted server/database code.
- Supabase Performance Advisor: 0 errors, 0 warnings, 27 accepted informational unused-index findings. The destination has no production workload yet; the indexes cover known catalogue/order queries, idempotency constraints, and foreign keys and must be assessed from real query statistics after cutover rather than removed pre-traffic.
- Real destination import/count comparison: pending credential-bearing cutover.
- Convex runtime removal: pending verified import; the rendered application already uses Supabase paths only.
