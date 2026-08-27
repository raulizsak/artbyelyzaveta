create extension if not exists pgtap with schema extensions;

begin;
select plan(16);

set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

insert into public.subscribers (email, source)
values ('Launch@Example.test', 'coming_soon');
select is(
  (select normalized_email from public.subscribers limit 1),
  'launch@example.test',
  'Subscriber email normalization is case insensitive'
);
select throws_ok(
  $$ insert into public.subscribers (email) values ('launch@example.test') $$,
  '23505', null,
  'Duplicate normalized subscriber emails are rejected by the database'
);

create temporary table test_demo_order as
select * from public.create_demo_order(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', null,
  'demo-guest@example.test', 'Demo', 'Guest', '0400000088',
  '{}'::jsonb, 'collection', 'Local database demo'
);

select is((select total_cents from test_demo_order), 88000, 'Demo order uses the authoritative database price');
select ok((select is_demo from public.orders where id = (select order_id from test_demo_order)), 'Order is explicitly marked as demo');
select is((select payment_status from public.orders where id = (select order_id from test_demo_order)), 'paid', 'Demo order is immediately confirmed as paid');
select is((select status from public.paintings where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'), 'sold', 'Demo checkout atomically marks the painting sold');
select is((select count(*) from public.email_outbox where order_id = (select order_id from test_demo_order)), 2::bigint, 'Customer and shop emails are queued');
select is(public.lookup_guest_order((select guest_token from test_demo_order)), (select order_id from test_demo_order), 'Guest receives private access to the demo order');
select throws_ok(
  $$ select * from public.create_demo_order('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', null, 'second@example.test', 'Second', 'Guest', null, '{}', 'collection', null) $$,
  'P0002', 'Sorry, this painting is no longer available.',
  'A sold one-of-one painting rejects a second demo order'
);

create temporary table test_demo_refund as
select * from public.process_demo_refund(
  (select order_id from test_demo_order), 88000, 'Demo workflow verification',
  '99999999-9999-4999-8999-999999999999',
  '11111111-1111-4111-8111-111111111111', true, true, true
);
select is((select payment_status from public.orders where id = (select order_id from test_demo_order)), 'refunded', 'Demo refund updates payment status without Stripe');
select is((select status from public.paintings where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'), 'available', 'Full demo refund can restock the painting');
select is((select count(*) from public.refunds where order_id = (select order_id from test_demo_order) and is_demo and status = 'succeeded'), 1::bigint, 'Demo refund is recorded as succeeded');

create temporary table test_demo_reset as
select * from public.reset_demo_order(
  (select order_id from test_demo_order),
  '11111111-1111-4111-8111-111111111111'
);
select is((select order_status from public.orders where id = (select order_id from test_demo_order)), 'cancelled', 'Reset preserves the order in a terminal demo state');
select is((select count(*) from public.order_events where order_id = (select order_id from test_demo_order) and event_type = 'demo_order_reset'), 1::bigint, 'Reset preserves a visible order timeline event');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal1"}', true);
select is((select count(*) from public.subscribers), 0::bigint, 'Customers cannot enumerate subscribers');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal2"}', true);
select is((select count(*) from public.subscribers), 1::bigint, 'AAL2 administrators can read subscribers');

select * from finish();
rollback;
