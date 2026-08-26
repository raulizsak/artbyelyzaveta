create extension if not exists pgtap with schema extensions;

begin;
select plan(16);

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
  (public.process_refund_event('evt_refund_1', 'refund.updated', 'pi_test_commerce', 're_test_1', 30000, 'succeeded', 'requested_by_customer', null) ->> 'status'),
  'processed', 'First partial refund is processed'
);
select is((select amount_refunded_cents from public.orders where id = (select order_id from test_reservation)), 30000, 'Partial refund total is correct');
select is(
  (public.process_refund_event('evt_refund_2', 'refund.updated', 'pi_test_commerce', 're_test_2', 58000, 'succeeded', 'requested_by_customer', null) ->> 'status'),
  'processed', 'Second partial refund is processed'
);
select is((select amount_refunded_cents from public.orders where id = (select order_id from test_reservation)), 88000, 'Multiple refunds are summed without exceeding order total');
select is((select payment_status from public.orders where id = (select order_id from test_reservation)), 'refunded', 'Full cumulative refund updates payment status');
select is((select count(*) from public.email_outbox where order_id = (select order_id from test_reservation) and template in ('order_confirmation', 'admin_new_order', 'refund_completed')), 4::bigint, 'Payment and refund emails are deduplicated into the outbox');

select * from finish();
rollback;
