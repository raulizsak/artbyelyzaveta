-- Atomic operational updates used by the AAL2-protected admin dashboard.

alter table public.paintings drop constraint paintings_reserved_order_id_fkey;
alter table public.paintings
  add constraint paintings_reserved_order_id_fkey
  foreign key (reserved_order_id) references public.orders (id) on delete restrict;

create unique index return_requests_one_open_per_order
  on public.return_requests (order_id)
  where status not in ('declined', 'refunded', 'closed');

create or replace function private.admin_update_order(
  p_order_id uuid,
  p_action text,
  p_changes jsonb,
  p_notify boolean default true
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_event_id uuid := gen_random_uuid();
  v_description text;
begin
  if not private.is_admin_aal2() then
    raise exception 'AAL2 administrator access required' using errcode = '42501';
  end if;
  if p_action not in ('fulfill', 'update', 'delay', 'cancel', 'commission_update') then
    raise exception 'Unsupported order action' using errcode = '22023';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;
  if p_changes ->> 'order_status' = 'cancelled' and v_order.payment_status in ('paid', 'partially_refunded') then
    raise exception 'Paid orders must use the refund workflow' using errcode = '22023';
  end if;

  update public.orders set
    fulfillment_status = case
      when p_changes ? 'fulfillment_status' and p_changes ->> 'fulfillment_status' in ('unfulfilled', 'preparing', 'shipped', 'delivered', 'cancelled', 'returned')
        then p_changes ->> 'fulfillment_status' else fulfillment_status end,
    order_status = case
      when p_changes ? 'order_status' and p_changes ->> 'order_status' in ('pending', 'confirmed', 'delayed', 'cancelled', 'refunded', 'completed')
        then p_changes ->> 'order_status' else order_status end,
    tracking_carrier = case when p_changes ? 'tracking_carrier' then nullif(btrim(p_changes ->> 'tracking_carrier'), '') else tracking_carrier end,
    tracking_number = case when p_changes ? 'tracking_number' then nullif(btrim(p_changes ->> 'tracking_number'), '') else tracking_number end,
    tracking_url = case when p_changes ? 'tracking_url' then nullif(btrim(p_changes ->> 'tracking_url'), '') else tracking_url end,
    commission_eta = case when p_changes ? 'commission_eta' then nullif(p_changes ->> 'commission_eta', '')::date else commission_eta end,
    customer_status_message = case when p_changes ? 'customer_status_message' then nullif(btrim(p_changes ->> 'customer_status_message'), '') else customer_status_message end,
    internal_admin_notes = case when p_changes ? 'internal_admin_notes' then nullif(btrim(p_changes ->> 'internal_admin_notes'), '') else internal_admin_notes end,
    shipped_at = case when p_changes ->> 'fulfillment_status' = 'shipped' then coalesce(shipped_at, now()) else shipped_at end,
    delivered_at = case when p_changes ->> 'fulfillment_status' = 'delivered' then coalesce(delivered_at, now()) else delivered_at end,
    updated_at = now()
  where id = p_order_id returning * into v_order;

  if p_changes ->> 'order_status' = 'cancelled' then
    perform private.release_checkout_reservation(p_order_id, 'Cancelled by administrator');
  end if;

  v_description := case p_action
    when 'fulfill' then 'Shipment details added.'
    when 'delay' then 'Order timing updated.'
    when 'cancel' then 'Order cancelled.'
    when 'commission_update' then 'Commission progress updated.'
    else 'Order status updated.'
  end;

  insert into public.order_events (id, order_id, event_type, actor_user_id, actor_type, customer_safe_description, internal_metadata)
  values (v_event_id, p_order_id, p_action, auth.uid(), 'admin', v_description, jsonb_build_object('changed_fields', (select jsonb_agg(key) from jsonb_each(p_changes))));
  insert into public.admin_audit_log (actor_user_id, action, target_type, target_id, safe_metadata)
  values (auth.uid(), 'order.' || p_action, 'order', p_order_id::text, jsonb_build_object('changed_fields', (select jsonb_agg(key) from jsonb_each(p_changes))));
  if p_notify then
    insert into public.email_outbox (order_id, template, recipient, payload, dedupe_key)
    values (p_order_id, case when p_action = 'fulfill' then 'shipment' else 'order_update' end, v_order.customer_email, jsonb_build_object('order_id', p_order_id, 'event_id', v_event_id), 'order_update:' || v_event_id::text);
  end if;
  return v_order;
end;
$$;

create or replace function public.admin_update_order(
  p_order_id uuid,
  p_action text,
  p_changes jsonb,
  p_notify boolean default true
)
returns public.orders
language sql
security invoker
set search_path = ''
as $$ select private.admin_update_order(p_order_id, p_action, p_changes, p_notify); $$;

create or replace function private.admin_update_return(
  p_return_id uuid,
  p_status text,
  p_response text,
  p_approved_refund_cents integer default null,
  p_notify boolean default true
)
returns public.return_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_return public.return_requests%rowtype;
  v_order public.orders%rowtype;
  v_event_id uuid := gen_random_uuid();
begin
  if not private.is_admin_aal2() then raise exception 'AAL2 administrator access required' using errcode = '42501'; end if;
  if p_status not in ('requested', 'needs_information', 'approved', 'declined', 'awaiting_return', 'received', 'refunded', 'closed') then raise exception 'Invalid return status' using errcode = '22023'; end if;
  select * into v_return from public.return_requests where id = p_return_id for update;
  if not found then raise exception 'Return not found' using errcode = 'P0002'; end if;
  if p_approved_refund_cents is not null and (p_approved_refund_cents < 0 or (v_return.requested_refund_cents is not null and p_approved_refund_cents > v_return.requested_refund_cents)) then raise exception 'Invalid approved refund amount' using errcode = '22023'; end if;
  update public.return_requests set status = p_status, admin_response = nullif(btrim(p_response), ''), approved_refund_cents = coalesce(p_approved_refund_cents, approved_refund_cents), updated_at = now() where id = p_return_id returning * into v_return;
  select * into v_order from public.orders where id = v_return.order_id;
  insert into public.order_events (id, order_id, event_type, actor_user_id, actor_type, customer_safe_description)
  values (v_event_id, v_return.order_id, 'return_' || p_status, auth.uid(), 'admin', 'Return request ' || replace(p_status, '_', ' ') || '.');
  insert into public.admin_audit_log (actor_user_id, action, target_type, target_id, safe_metadata)
  values (auth.uid(), 'return.' || p_status, 'return_request', p_return_id::text, jsonb_build_object('approved_refund_cents', p_approved_refund_cents));
  if p_notify then
    insert into public.email_outbox (order_id, template, recipient, payload, dedupe_key)
    values (v_return.order_id, 'return_' || p_status, v_order.customer_email, jsonb_build_object('return_id', p_return_id, 'event_id', v_event_id), 'return_update:' || v_event_id::text);
  end if;
  return v_return;
end;
$$;

create or replace function public.admin_update_return(
  p_return_id uuid,
  p_status text,
  p_response text,
  p_approved_refund_cents integer default null,
  p_notify boolean default true
)
returns public.return_requests
language sql
security invoker
set search_path = ''
as $$ select private.admin_update_return(p_return_id, p_status, p_response, p_approved_refund_cents, p_notify); $$;

revoke all on function public.admin_update_order(uuid, text, jsonb, boolean) from public, anon;
grant execute on function public.admin_update_order(uuid, text, jsonb, boolean) to authenticated;
revoke all on function public.admin_update_return(uuid, text, text, integer, boolean) from public, anon;
grant execute on function public.admin_update_return(uuid, text, text, integer, boolean) to authenticated;

create or replace function private.claim_email_outbox(p_order_id uuid default null, p_limit integer default 10)
returns setof public.email_outbox
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required' using errcode = '42501'; end if;
  return query
  with candidates as (
    select id from public.email_outbox
    where status in ('pending', 'failed')
      and next_attempt_at <= now()
      and attempts < 5
      and (p_order_id is null or order_id = p_order_id)
    order by created_at
    limit greatest(1, least(p_limit, 25))
    for update skip locked
  )
  update public.email_outbox e
  set status = 'sending', attempts = attempts + 1, updated_at = now()
  from candidates c where e.id = c.id
  returning e.*;
end;
$$;

create or replace function public.claim_email_outbox(p_order_id uuid default null, p_limit integer default 10)
returns setof public.email_outbox
language sql
security invoker
set search_path = ''
as $$ select * from private.claim_email_outbox(p_order_id, p_limit); $$;
revoke all on function public.claim_email_outbox(uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_email_outbox(uuid, integer) to service_role;

create or replace function private.process_setup_intent_event(
  p_event_id text, p_user_id uuid, p_payment_method_id text, p_brand text,
  p_last4 text, p_exp_month integer, p_exp_year integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required' using errcode = '42501'; end if;
  insert into public.stripe_events (stripe_event_id, event_type, status, result, processed_at)
  values (p_event_id, 'setup_intent.succeeded', 'processed', jsonb_build_object('user_id', p_user_id), now())
  on conflict (stripe_event_id) do nothing;
  if not found then return jsonb_build_object('status', 'duplicate'); end if;
  insert into public.payment_methods (user_id, stripe_payment_method_id, brand, last4, exp_month, exp_year, is_default)
  values (p_user_id, p_payment_method_id, p_brand, p_last4, p_exp_month, p_exp_year,
    not exists (select 1 from public.payment_methods where user_id = p_user_id))
  on conflict (stripe_payment_method_id) do update set
    brand = excluded.brand, last4 = excluded.last4, exp_month = excluded.exp_month, exp_year = excluded.exp_year, updated_at = now();
  return jsonb_build_object('status', 'processed');
end;
$$;

create or replace function public.process_setup_intent_event(
  p_event_id text, p_user_id uuid, p_payment_method_id text, p_brand text,
  p_last4 text, p_exp_month integer, p_exp_year integer
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.process_setup_intent_event(p_event_id, p_user_id, p_payment_method_id, p_brand, p_last4, p_exp_month, p_exp_year); $$;
revoke all on function public.process_setup_intent_event(text, uuid, text, text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.process_setup_intent_event(text, uuid, text, text, text, integer, integer) to service_role;

create or replace function private.process_refund_event(
  p_event_id text, p_event_type text, p_payment_intent_id text,
  p_refund_id text, p_amount_cents integer, p_status text,
  p_reason text default null, p_failure_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_total integer;
  v_status text := case when p_status = 'canceled' then 'cancelled' else p_status end;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required' using errcode = '42501'; end if;
  insert into public.stripe_events (stripe_event_id, event_type)
  values (p_event_id, p_event_type) on conflict (stripe_event_id) do nothing;
  if not found then return jsonb_build_object('status', 'duplicate'); end if;
  select * into v_order from public.orders where stripe_payment_intent_id = p_payment_intent_id for update;
  if not found then
    update public.stripe_events set status = 'failed', result = '{"reason":"order_not_found"}', processed_at = now() where stripe_event_id = p_event_id;
    return jsonb_build_object('status', 'failed');
  end if;
  if p_refund_id is not null then
    insert into public.refunds (order_id, stripe_refund_id, amount_cents, status, reason, failure_reason)
    values (v_order.id, p_refund_id, greatest(p_amount_cents, 1),
      case when v_status in ('pending', 'requires_action', 'succeeded', 'failed', 'cancelled') then v_status else 'pending' end,
      coalesce(nullif(p_reason, ''), 'requested_by_customer'), nullif(p_failure_reason, ''))
    on conflict (stripe_refund_id) do update set status = excluded.status, failure_reason = excluded.failure_reason, amount_cents = excluded.amount_cents, updated_at = now();
  end if;
  if p_event_type = 'charge.refunded' then
    v_total := least(v_order.total_cents, greatest(p_amount_cents, 0));
  else
    select coalesce(sum(amount_cents) filter (where status = 'succeeded'), 0) into v_total from public.refunds where order_id = v_order.id;
  end if;
  update public.orders set
    amount_refunded_cents = v_total,
    refund_status = case when v_status = 'failed' then 'failed' when v_total >= total_cents then 'full' when v_total > 0 then 'partial' else 'pending' end,
    payment_status = case when v_total >= total_cents then 'refunded' when v_total > 0 then 'partially_refunded' else payment_status end,
    order_status = case when v_total >= total_cents then 'refunded' else order_status end,
    updated_at = now()
  where id = v_order.id;
  insert into public.order_events (order_id, event_type, stripe_event_id, actor_type, customer_safe_description)
  values (v_order.id, case when v_status = 'succeeded' or p_event_type = 'charge.refunded' then 'refund_completed' else 'refund_updated' end,
    p_event_id, 'stripe', case when v_status = 'succeeded' or p_event_type = 'charge.refunded' then 'Refund completed.' else 'Refund status updated.' end);
  if v_status = 'succeeded' or p_event_type = 'charge.refunded' then
    insert into public.email_outbox (order_id, template, recipient, payload, dedupe_key)
    values (v_order.id, 'refund_completed', v_order.customer_email, jsonb_build_object('order_id', v_order.id), 'refund:' || p_event_id)
    on conflict (dedupe_key) do nothing;
  end if;
  update public.stripe_events set status = 'processed', result = jsonb_build_object('order_id', v_order.id, 'amount_refunded_cents', v_total), processed_at = now() where stripe_event_id = p_event_id;
  return jsonb_build_object('status', 'processed', 'order_id', v_order.id);
end;
$$;

create or replace function public.process_refund_event(
  p_event_id text, p_event_type text, p_payment_intent_id text,
  p_refund_id text, p_amount_cents integer, p_status text,
  p_reason text default null, p_failure_reason text default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.process_refund_event(p_event_id, p_event_type, p_payment_intent_id, p_refund_id, p_amount_cents, p_status, p_reason, p_failure_reason); $$;
revoke all on function public.process_refund_event(text, text, text, text, integer, text, text, text) from public, anon, authenticated;
grant execute on function public.process_refund_event(text, text, text, text, integer, text, text, text) to service_role;
