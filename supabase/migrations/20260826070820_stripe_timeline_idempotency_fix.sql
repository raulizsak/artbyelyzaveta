-- A regular UNIQUE constraint still permits multiple NULL values, while also
-- providing an inferable conflict target for Stripe-backed timeline events.
-- The original partial index caused every `on conflict (stripe_event_id)`
-- statement in payment/refund processing to fail at runtime.
drop index if exists public.order_events_stripe_event_unique;

alter table public.order_events
  add constraint order_events_stripe_event_unique unique (stripe_event_id);
