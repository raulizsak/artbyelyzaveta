create extension if not exists pgtap with schema extensions;
begin;
select plan(23);
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
insert into public.paintings (id,slug,title,price_cents,shipping_cents,currency,status,published_at)
values ('ab000000-0000-4000-8000-000000000001','prelaunch-local-one','Isolated test artwork',100000,2500,'AUD','available',now()),
('ab000000-0000-4000-8000-000000000002','prelaunch-local-two','Isolated collection artwork',80000,4200,'AUD','available',now());
insert into public.discounts(code,discount_type,percent_off,starts_at) values ('PRELAUNCH10','percentage',10,now()-interval '1 minute');
create temporary table shipping as select * from public.create_commerce_checkout(
array['ab000000-0000-4000-8000-000000000001'::uuid],null,'qa@example.test','QA','Buyer','0400000000','{"line1":"1 Test St"}','shipping',null,array['PRELAUNCH10'],30);
select is((select subtotal_cents from shipping),100000,'Artwork subtotal comes from database');
select is((select discount_cents from shipping),10000,'Percentage discount applies to artwork');
select is((select shipping_cents from shipping),2500,'Painting-specific shipping remains undiscounted');
select is((select total_cents from shipping),92500,'Discount plus shipping total is authoritative');
select throws_ok($$select * from public.create_commerce_checkout(array['ab000000-0000-4000-8000-000000000001'::uuid],null,'other@example.test','Second','Buyer',null,'{}','collection',null,'{}',30)$$,'P0002','painting_unavailable','Second buyer cannot reserve the same original');
update public.orders set stripe_mode='test',stripe_checkout_session_id='cs_test_prelaunch',stripe_payment_intent_id='pi_prelaunch' where id=(select order_id from shipping);
update public.paintings set reserved_until=now()-interval '1 minute' where id='ab000000-0000-4000-8000-000000000001';
select throws_ok($$select * from public.create_commerce_checkout(array['ab000000-0000-4000-8000-000000000001'::uuid],null,'other@example.test','Second','Buyer',null,'{}','collection',null,'{}',30)$$,'P0002','painting_unavailable','Clock expiry cannot release a potentially payable Stripe session');
select is((public.process_commerce_stripe_event('evt_prelaunch_decline','payment_intent.payment_failed','test',jsonb_build_object('order_id',(select order_id from shipping),'payment_intent_id','pi_prelaunch'))->>'status'),'processed','Retryable card decline accepted');
select is((select status from public.paintings where id='ab000000-0000-4000-8000-000000000001'),'reserved','Declined card retains inventory until session closure');
select is((select payment_status from public.orders where id=(select order_id from shipping)),'pending','Decline does not create a paid order');
select is((public.process_commerce_stripe_event('evt_prelaunch_paid','checkout.session.completed','test',jsonb_build_object('order_id',(select order_id from shipping),'session_id','cs_test_prelaunch','payment_status','paid','amount_total',92500,'amount_discount',10000,'amount_shipping',2500,'currency','aud'))->>'status'),'processed','Delayed signed payment confirms original reservation');
select is((select status from public.paintings where id='ab000000-0000-4000-8000-000000000001'),'sold','Confirmed original is sold');
select is((select payment_status from public.orders where id=(select order_id from shipping)),'paid','Payment state is server owned');
select is((public.process_commerce_stripe_event('evt_prelaunch_paid','checkout.session.completed','test','{}')->>'status'),'duplicate','Duplicate webhook has no repeated effects');
select is((public.process_commerce_stripe_event('evt_prelaunch_second_paid','payment_intent.succeeded','test',jsonb_build_object('order_id',(select order_id from shipping),'amount_total',92500))->>'status'),'ignored','Different success event does not repeat finalization');
select is((select count(*) from public.email_outbox where order_id=(select order_id from shipping)),2::bigint,'Exactly one customer and one owner confirmation queued');
select is((select count(*) from public.order_events where order_id=(select order_id from shipping) and event_type='payment_confirmed'),1::bigint,'Only one payment-confirmed timeline event');
create temporary table collection as select * from public.create_commerce_checkout(array['ab000000-0000-4000-8000-000000000002'::uuid],null,'collection@example.test','QA','Collection',null,'{}','collection',null,'{}',30);
select is((select shipping_cents from collection),0,'Collection always has zero shipping');
select is((select total_cents from collection),80000,'Collection total excludes stored painting shipping');
select is((public.process_commerce_stripe_event('evt_prelaunch_expired','checkout.session.expired','test',jsonb_build_object('order_id',(select order_id from collection)))->>'status'),'processed','Signed terminal expiry is processed');
select is((select status from public.paintings where id='ab000000-0000-4000-8000-000000000002'),'available','Signed expiry safely recovers inventory');
select throws_ok($$select * from public.create_commerce_checkout(array['ab000000-0000-4000-8000-000000000002'::uuid],null,'invalid@example.test','QA','Invalid',null,'{}','collection',null,array['INVALIDCODE'],30)$$,'P0001','discount_invalid','Invalid discount rejected by database');
select is((select status from public.paintings where id='ab000000-0000-4000-8000-000000000002'),'available','Invalid discount does not lock inventory');
select is((select count(*) from public.email_outbox where order_id=(select order_id from collection)),0::bigint,'Abandoned checkout sends no paid confirmation');
select * from finish();
rollback;
