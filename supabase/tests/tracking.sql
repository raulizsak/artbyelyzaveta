create extension if not exists pgtap with schema extensions;

begin;
select plan(25);

update public.orders
set fulfillment_status = 'shipped',
    order_status = 'confirmed',
    delivery_method = 'shipping',
    is_demo = false,
    tracking_carrier = 'Australia Post',
    tracking_number = '33OLD1234567',
    tracking_url = null
where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';

select is(
  (select tracking_registration_status from public.orders where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'),
  'pending',
  'A newly shipped Australia Post order is pending registration'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal2"}', true);

create temporary table first_tracking_claim as
select public.admin_claim_tracking_registration('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1') as result;
select is((select result ->> 'claimed' from first_tracking_claim), 'true', 'The first save claims registration');
select is(
  public.admin_claim_tracking_registration('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1') ->> 'reason',
  'in_progress',
  'A repeated save does not make another provider registration claim'
);
select is(
  public.admin_complete_tracking_registration(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', '33OLD1234567', true, null
  ) ->> 'registered',
  'true',
  'A successful provider response completes registration'
);
select is(
  public.admin_claim_tracking_registration('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1') ->> 'reason',
  'already_registered',
  'A registered current number remains idempotent'
);

reset role;
update public.orders
set tracking_number = '33NEW1234567'
where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';

set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select is(
  public.record_17track_webhook(
    '33OLD1234567', 1151, 'Delivered',
    '{"description":"Old shipment delivered","time":"2026-10-02T00:00:00Z"}'::jsonb,
    true, '2026-10-02T00:00:00Z', null
  ) ->> 'matched',
  'false',
  'A stale previous tracking-number webhook is ignored'
);
select is(
  (select tracking_status from public.orders where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'),
  null::text,
  'A stale webhook does not update tracking state'
);
select is(
  public.record_17track_webhook(
    'UNKNOWN12345', 1151, 'InTransit', null, false, null, null
  ) ->> 'matched',
  'false',
  'An unknown tracking number is acknowledged without mutation'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal2"}', true);
select is(
  public.admin_claim_tracking_registration('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1') ->> 'claimed',
  'true',
  'The corrected tracking number can be registered'
);
select is(
  public.admin_complete_tracking_registration(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', '33NEW1234567', true, null
  ) ->> 'registered',
  'true',
  'The corrected tracking number becomes current'
);

reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select is(
  public.record_17track_webhook(
    '33NEW1234567', 1151, 'InfoReceived',
    '{"description":"Shipping information received","time":"2026-10-02T00:00:00Z"}'::jsonb,
    false, null, null
  ) ->> 'matched',
  'true',
  'A current InfoReceived webhook is processed'
);
select is(
  (select tracking_status from public.orders where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'),
  'InfoReceived',
  'A non-delivered status is stored'
);
select is(
  (select fulfillment_status from public.orders where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'),
  'shipped',
  'A non-delivered status preserves Shipped fulfillment'
);

create temporary table delivered_webhook_result as
select public.record_17track_webhook(
  '33NEW1234567', 1151, 'Delivered',
  '{"description":"Delivered","time":"2026-10-02T01:00:00Z"}'::jsonb,
  true, '2026-10-02T01:00:00Z', null
) as result;
select is((select result ->> 'transitioned_to_delivered' from delivered_webhook_result), 'true', 'Delivered transitions exactly once');
select is((select fulfillment_status from public.orders where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'), 'delivered', 'Delivered webhook completes fulfillment');
select is((select count(*) from public.email_outbox where order_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1' and template = 'delivered'), 1::bigint, 'Delivered email is queued once');
select is((select count(*) from public.order_events where order_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1' and event_type = 'delivered'), 1::bigint, 'Delivered timeline event is recorded once');
select is(
  public.record_17track_webhook(
    '33NEW1234567', 1151, 'Delivered',
    '{"description":"Delivered","time":"2026-10-02T01:00:00Z"}'::jsonb,
    true, '2026-10-02T01:00:00Z', null
  ) ->> 'transitioned_to_delivered',
  'false',
  'A duplicate Delivered webhook is harmless'
);
select is((select count(*) from public.email_outbox where order_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1' and template = 'delivered'), 1::bigint, 'A duplicate webhook does not queue duplicate email');
select is((select count(*) from public.order_events where order_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1' and event_type = 'delivered'), 1::bigint, 'A duplicate webhook does not duplicate the timeline');

select is(
  public.record_17track_webhook(
    '33NEW1234567', 1151, null, null, false, null,
    '17TRACK stopped automatic tracking for this shipment.'
  ) ->> 'matched',
  'true',
  'A documented TRACKING_STOPPED notification is recorded'
);
select is(
  (select tracking_registration_status from public.orders where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'),
  'stopped',
  'A stopped subscription is visible to administrators'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal2"}', true);
select ok(
  public.admin_mark_order_delivered(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
    'Delivered',
    '{"description":"Marked as delivered by the studio."}'::jsonb
  ) is not null,
  'Manual Delivered fallback remains callable'
);
select is((select fulfillment_status from public.orders where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'), 'delivered', 'Manual Delivered fallback still completes fulfillment');
select is((select count(*) from public.email_outbox where order_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2' and template = 'delivered'), 1::bigint, 'Manual Delivered queues one deduplicated email');

select * from finish();
rollback;
