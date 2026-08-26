create extension if not exists pgtap with schema extensions;

begin;
select plan(23);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal1","email":"customer-a@example.test"}',
  true
);

select is((select count(*) from public.profiles), 1::bigint, 'Customer A sees only their profile');
select is((select count(*) from public.profiles where id = '33333333-3333-4333-8333-333333333333'), 0::bigint, 'Customer A cannot see Customer B profile');
select is((select count(*) from public.orders), 1::bigint, 'Customer A sees only their order');
select is((select count(*) from public.orders where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'), 0::bigint, 'Customer A cannot see Customer B order');
select is((select count(*) from public.customer_addresses), 1::bigint, 'Customer A sees only their address');
select is((select count(*) from public.customer_addresses where user_id = '33333333-3333-4333-8333-333333333333'), 0::bigint, 'Customer A cannot see Customer B address');
select is((select count(*) from public.invoices), 1::bigint, 'Customer A sees only their invoice');
select is((select count(*) from public.invoices where order_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'), 0::bigint, 'Customer A cannot see Customer B invoice');
select is((select count(*) from public.return_requests), 1::bigint, 'Customer A sees only their return request');
select is((select count(*) from public.return_requests where user_id = '33333333-3333-4333-8333-333333333333'), 0::bigint, 'Customer A cannot see Customer B return request');
select is((select count(*) from public.order_items), 1::bigint, 'Customer A sees only items from their order');
select throws_ok(
  $$ update public.profiles set role = 'admin' where id = '22222222-2222-4222-8222-222222222222' $$,
  '42501',
  null,
  'A customer cannot self-assign the admin role'
);
select throws_ok(
  $$ select public.create_checkout_reservation('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', null, 'attacker@example.test', 'A', 'B', null, '{}'::jsonb, 'collection', null, 0, 30) $$,
  '42501',
  null,
  'A customer cannot call the service-only reservation RPC directly'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1","email":"admin@example.test"}',
  true
);
select is((select count(*) from public.orders), 0::bigint, 'Admin at AAL1 cannot read customer orders');
select is((select count(*) from public.customer_addresses), 0::bigint, 'Admin at AAL1 cannot read customer addresses');
select ok(not (select is_aal2 from public.admin_access_state()), 'Admin access state rejects AAL1');

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal2","email":"admin@example.test"}',
  true
);
select is((select count(*) from public.orders), 3::bigint, 'Admin at AAL2 can read all fixture orders');
select is((select count(*) from public.customer_addresses), 2::bigint, 'Admin at AAL2 can read customer addresses');
select is((select count(*) from public.invoices), 2::bigint, 'Admin at AAL2 can read invoices');
select is((select count(*) from public.return_requests), 2::bigint, 'Admin at AAL2 can read returns');
select ok((select is_admin and is_aal2 from public.admin_access_state()), 'Admin access state accepts AAL2');

reset role;
set local role anon;
select is((select count(*) from public.paintings), 3::bigint, 'Anonymous visitors can read the published catalogue');
select throws_ok(
  $$ select count(*) from public.orders $$,
  '42501',
  null,
  'Anonymous visitors cannot enumerate orders'
);

select * from finish();
rollback;
