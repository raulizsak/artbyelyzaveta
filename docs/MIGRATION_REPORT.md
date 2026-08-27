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

The dry-run and production execution validate one painting, three commission enquiries, three private files, unique slugs, preserved statuses/timestamps, and the 20-item media manifest. The script emits counts only and does not log enquiry PII.

## Destination schema

The schema, triggers, functions, RLS, policies, buckets, and seed are reproducible from nine committed migrations. All nine have been applied to the connected Supabase project. The later migrations correct Stripe timeline idempotency, remove unnecessary public Storage enumeration, consolidate authenticated RLS policies, cover foreign keys reported by the performance advisor, and add subscribers plus transactional demo commerce.

## Cutover status

The production import completed successfully and was safely retried through idempotent upserts after correcting exported image filename extensions. Destination counts match the source: one painting, zero contact enquiries, three commission enquiries, and three private inspiration-file metadata rows. All 20 optimized artwork variants were uploaded to the public artwork bucket. The application Convex provider, generated/source directory, npm packages, scripts, and environment references have been removed.

The existing cloud Convex project must remain intact as rollback protection. It is not to be deleted in this phase.

## Verification record

- Export/dry run: passed.
- Optimized media generation: passed.
- Fresh local migration plus fake seed: passed.
- pgTAP commerce/RLS/storage/demo commerce: 82/82 passed.
- Supabase Security Advisor: 0 errors, 1 accepted warning, and 2 accepted informational findings. Leaked-password protection is not available on Supabase Free; `rate_limit_events` and `stripe_events` intentionally have no client policy and are deny-all outside trusted server/database code.
- Supabase Performance Advisor: 0 errors, 0 warnings, 28 accepted informational unused-index findings. The destination has only the imported low-traffic data; the indexes cover known catalogue/subscriber/order queries, idempotency constraints, and foreign keys and must be assessed from real query statistics after traffic rather than removed prematurely.
- Real destination import/count comparison: passed (1 painting, 0 contact enquiries, 3 commission enquiries, 3 private inspiration files, 20 optimized artwork variants).
- Convex runtime removal: complete. Cloud Convex data remains untouched as rollback protection.
