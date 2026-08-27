create extension if not exists pgtap with schema extensions;

begin;
select plan(27);

set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

create temporary table test_reservation as
select * from public.create_checkout_reservation(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', null, 'guest-checkout@example.test',
  'Guest', 'Checkout', '0400000099', '{}', 'collection', null, 0, 30
);

select is((select count(*) from test_reservation), 1::bigint, 'Available artwork creates one reservation');
select is((select total_cents from test_reservation), 88000, 'Reservation uses authoritative database price');
select is((select status from public.paintings where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'), 'reserved', 'Painting is atomically reserved');
select throws_ok(
  $$ select * from public.create_checkout_reservation('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', null, 'second@example.test', 'Second', 'Buyer', null, '{}', 'collection', null, 0, 30) $$,
  'P0002', 'Sorry, this painting is no longer available.',
  'A simultaneous second reservation is rejected'
);
select is(
  public.lookup_guest_order((select guest_token from test_reservation)),
  (select order_id from test_reservation),
  'High-entropy guest token resolves only its order'
);
select is(public.lookup_guest_order('incorrect-token'), null::uuid, 'Incorrect guest token reveals no order');

update public.orders set stripe_payment_intent_id = 'pi_test_commerce' where id = (select order_id from test_reservation);
select is(
  (public.process_stripe_event('evt_test_paid', 'payment_intent.succeeded', jsonb_build_object('order_id', (select order_id from test_reservation), 'payment_intent_id', 'pi_test_commerce', 'amount_total', 88000)) ->> 'status'),
  'processed', 'Signed payment event is processed'
);
select is((select payment_status from public.orders where id = (select order_id from test_reservation)), 'paid', 'Paid event marks order paid');
select is((select status from public.paintings where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'), 'sold', 'Paid event marks unique artwork sold');
select is(
  (public.process_stripe_event('evt_test_paid', 'payment_intent.succeeded', '{}'::jsonb) ->> 'status'),
  'duplicate', 'Duplicate Stripe event is idempotent'
);
select is(
  public.lookup_guest_order((select guest_token from test_reservation)),
  null::uuid,
  'The pre-payment guest token is invalidated after payment'
);
select is(
  public.lookup_guest_order((
    select payload ->> 'guest_token'
    from public.email_outbox
    where order_id = (select order_id from test_reservation)
      and template = 'order_confirmation'
  )),
  (select order_id from test_reservation),
  'The paid-order email token resolves only the guest order'
);
select is(
  length((
    select payload ->> 'guest_token'
    from public.email_outbox
    where order_id = (select order_id from test_reservation)
      and template = 'order_confirmation'
  )),
  64,
  'The emailed guest token contains 256 bits of random data'
);

select is(
  (public.process_refund_event('evt_refund_1', 'refund.updated', 'pi_test_commerce', 're_test_1', 30000, 'succeeded', 'requested_by_customer', null) ->> 'status'),
  'processed', 'First partial refund is processed'
);
select is((select amount_refunded_cents from public.orders where id = (select order_id from test_reservation)), 30000, 'Partial refund total is correct');
insert into public.refunds (
  order_id, stripe_refund_id, amount_cents, status, reason, restock_on_success
) values (
  (select order_id from test_reservation), 're_test_2', 58000,
  'pending', 'requested_by_customer', true
);
select is(
  (public.process_refund_event('evt_refund_2', 'refund.updated', 'pi_test_commerce', 're_test_2', 58000, 'succeeded', 'requested_by_customer', null) ->> 'status'),
  'processed', 'Second partial refund is processed'
);
select is((select amount_refunded_cents from public.orders where id = (select order_id from test_reservation)), 88000, 'Multiple refunds are summed without exceeding order total');
select is((select payment_status from public.orders where id = (select order_id from test_reservation)), 'refunded', 'Full cumulative refund updates payment status');
select is(
  (select status from public.paintings where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'),
  'available',
  'A full successful cancellation refund restocks only when explicitly requested'
);
select is(
  (public.process_refund_event('evt_refund_2', 'refund.updated', 'pi_test_commerce', 're_test_2', 58000, 'succeeded', 'requested_by_customer', null) ->> 'status'),
  'duplicate',
  'A duplicate refund event is idempotent'
);
select is((select count(*) from public.email_outbox where order_id = (select order_id from test_reservation) and template in ('order_confirmation', 'admin_new_order', 'refund_completed')), 4::bigint, 'Payment and refund emails are deduplicated into the outbox');

insert into public.paintings (
  id, slug, title, price_cents, status, published_at
) values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', 'failed-payment-fixture',
  'Failed Payment Fixture', 50000, 'available', now()
);
create temporary table test_failed_reservation as
select * from public.create_checkout_reservation(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', null, 'failed@example.test',
  'Failed', 'Payment', null, '{}', 'collection', null, 0, 30
);
update public.orders
set stripe_payment_intent_id = 'pi_test_failed'
where id = (select order_id from test_failed_reservation);
select is(
  (public.process_stripe_event(
    'evt_test_failed', 'payment_intent.payment_failed',
    jsonb_build_object('order_id', (select order_id from test_failed_reservation), 'payment_intent_id', 'pi_test_failed')
  ) ->> 'status'),
  'processed',
  'A signed failed-payment event is processed'
);
select is(
  (select payment_status from public.orders where id = (select order_id from test_failed_reservation)),
  'failed',
  'A failed payment updates the order safely'
);
select is(
  (select status from public.paintings where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4'),
  'available',
  'A failed payment releases the one-of-one reservation'
);

insert into public.paintings (
  id, slug, title, price_cents, status, published_at
) values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5', 'amount-mismatch-fixture',
  'Amount Mismatch Fixture', 72000, 'available', now()
);
create temporary table test_mismatch_reservation as
select * from public.create_checkout_reservation(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5', null, 'mismatch@example.test',
  'Amount', 'Mismatch', null, '{}', 'collection', null, 0, 30
);
update public.orders
set stripe_payment_intent_id = 'pi_test_mismatch'
where id = (select order_id from test_mismatch_reservation);
select is(
  (public.process_stripe_event(
    'evt_test_mismatch', 'payment_intent.succeeded',
    jsonb_build_object(
      'order_id', (select order_id from test_mismatch_reservation),
      'payment_intent_id', 'pi_test_mismatch', 'amount_total', 1
    )
  ) ->> 'status'),
  'failed',
  'A tampered payment amount is rejected'
);
select is(
  (select payment_status from public.orders where id = (select order_id from test_mismatch_reservation)),
  'pending',
  'An amount mismatch never marks the order paid'
);
select is(
  (select status from public.paintings where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5'),
  'reserved',
  'An amount mismatch leaves the reservation for safe expiry handling'
);

select * from finish();
rollback;
