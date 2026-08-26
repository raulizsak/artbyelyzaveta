-- Safe local-only fixtures. These identities and addresses are fictional.
-- Supabase applies this file only during an explicit local db reset.

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'admin@example.test', extensions.crypt('LocalTest-Admin-2026', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"first_name":"Avery","last_name":"Admin"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'customer-a@example.test', extensions.crypt('LocalTest-CustomerA-2026', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"first_name":"Alex","last_name":"Collector"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'customer-b@example.test', extensions.crypt('LocalTest-CustomerB-2026', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"first_name":"Bailey","last_name":"Buyer"}', now(), now())
on conflict (id) do nothing;

update public.profiles
set role = 'admin'
where id = '11111111-1111-4111-8111-111111111111';

insert into public.paintings (
  id, slug, title, description, story, price_cents, currency,
  width_cm, height_cm, depth_cm, medium, surface, category, orientation,
  status, featured, year, published_at
) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'meadow-light', 'Meadow Light', 'A luminous pastoral study.', 'A fictional fixture created for local testing.', 88000, 'AUD', 76, 61, 3.5, 'Oil', 'Linen', 'Landscape', 'landscape', 'available', true, 2026, now()),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'winter-gum', 'Winter Gum', 'A quiet eucalyptus portrait.', 'A fictional fixture created for local testing.', 64000, 'AUD', 50, 70, 3.5, 'Oil', 'Canvas', 'Botanical', 'portrait', 'sold', false, 2025, now()),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'river-stillness', 'River Stillness', 'A broad river at dusk.', 'A fictional fixture created for local testing.', 112000, 'AUD', 100, 70, 4, 'Oil', 'Canvas', 'Landscape', 'landscape', 'available', false, 2026, now())
on conflict (id) do nothing;

insert into public.orders (
  id, order_reference, customer_user_id, customer_email, customer_first_name,
  customer_last_name, customer_phone, shipping_address, delivery_method,
  order_type, currency, subtotal_cents, total_cents, payment_status,
  fulfillment_status, order_status, paid_at
) values
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'ABE-2026-A1B2C3D4E5', '22222222-2222-4222-8222-222222222222', 'customer-a@example.test', 'Alex', 'Collector', '0400000001', '{"line1":"1 Example Street","suburb":"Sydney","state":"NSW","postcode":"2000","country":"Australia"}', 'shipping', 'original', 'AUD', 64000, 64000, 'paid', 'preparing', 'confirmed', now()),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'ABE-2026-F6E5D4C3B2', '33333333-3333-4333-8333-333333333333', 'customer-b@example.test', 'Bailey', 'Buyer', '0400000002', '{"line1":"2 Fixture Road","suburb":"Melbourne","state":"VIC","postcode":"3000","country":"Australia"}', 'shipping', 'commission', 'AUD', 150000, 150000, 'paid', 'unfulfilled', 'confirmed', now()),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3', 'ABE-2026-1234ABCDE0', null, 'guest@example.test', 'Guest', 'Collector', null, '{"line1":"3 Test Avenue","suburb":"Brisbane","state":"QLD","postcode":"4000","country":"Australia"}', 'shipping', 'original', 'AUD', 112000, 112000, 'pending', 'unfulfilled', 'pending', null)
on conflict (id) do nothing;

insert into public.order_items (
  id, order_id, painting_id, painting_slug, title, dimensions, medium,
  quantity, unit_price_cents, line_total_cents
) values
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'winter-gum', 'Winter Gum', '50 × 70 × 3.5 cm', 'Oil', 1, 64000, 64000),
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc2', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', null, 'commission-study', 'Commission Study', 'Custom', 'Oil', 1, 150000, 150000),
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc3', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'river-stillness', 'River Stillness', '100 × 70 × 4 cm', 'Oil', 1, 112000, 112000)
on conflict (id) do nothing;

insert into public.customer_addresses (
  id, user_id, label, recipient_name, line1, suburb, state, postcode, country, is_default
) values
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1', '22222222-2222-4222-8222-222222222222', 'Home', 'Alex Collector', '1 Example Street', 'Sydney', 'NSW', '2000', 'Australia', true),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2', '33333333-3333-4333-8333-333333333333', 'Home', 'Bailey Buyer', '2 Fixture Road', 'Melbourne', 'VIC', '3000', 'Australia', true)
on conflict (id) do nothing;

insert into public.invoices (id, order_id, invoice_reference, version)
values
  ('ffffffff-ffff-4fff-8fff-fffffffffff1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'INV-TEST-A', 1),
  ('ffffffff-ffff-4fff-8fff-fffffffffff2', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'INV-TEST-B', 1)
on conflict (id) do nothing;

update public.paintings
set status = 'reserved',
    reserved_order_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3',
    reserved_until = now() + interval '30 minutes'
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';

insert into public.return_requests (
  id, order_id, user_id, reason, explanation, requested_refund_cents
) values (
  'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  '22222222-2222-4222-8222-222222222222',
  'Fixture return',
  'This is a fictional return request used only for local authorization tests.',
  64000
) on conflict (id) do nothing;

insert into public.return_requests (
  id, order_id, user_id, reason, explanation, requested_refund_cents
) values (
  'dddddddd-dddd-4ddd-8ddd-ddddddddddd2',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
  '33333333-3333-4333-8333-333333333333',
  'Second fixture return',
  'This is another fictional return request used for cross-user authorization tests.',
  150000
) on conflict (id) do nothing;
