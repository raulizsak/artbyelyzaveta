create table public.subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null check (
    char_length(email) between 3 and 320
    and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  normalized_email text generated always as (lower(btrim(email))) stored,
  subscribed_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('active', 'unsubscribed', 'bounced')),
  source text not null default 'coming_soon' check (char_length(source) between 1 and 80),
  unique (normalized_email)
);

create index subscribers_status_date_idx
  on public.subscribers (status, subscribed_at desc);

alter table public.subscribers enable row level security;

create policy subscribers_admin_aal2_select on public.subscribers
for select to authenticated
using ((select private.is_admin_aal2()));

revoke all on table public.subscribers from public, anon;
grant select on table public.subscribers to authenticated;
grant all on table public.subscribers to service_role;

alter table public.orders
  add column is_demo boolean not null default false;

alter table public.refunds
  add column is_demo boolean not null default false,
  add column demo_reference text unique;

alter table public.contact_enquiries
  add column notification_status text not null default 'pending'
    check (notification_status in ('pending', 'sent', 'failed')),
  add column notification_sent_at timestamptz,
  add column notification_provider_id text,
  add column notification_error text;

alter table public.commission_enquiries
  add column notification_status text not null default 'pending'
    check (notification_status in ('pending', 'sent', 'failed')),
  add column notification_sent_at timestamptz,
  add column notification_provider_id text,
  add column notification_error text;

create or replace function private.create_demo_order(
  p_painting_id uuid,
  p_customer_user_id uuid,
  p_customer_email text,
  p_customer_first_name text,
  p_customer_last_name text,
  p_customer_phone text,
  p_shipping_address jsonb,
  p_delivery_method text,
  p_delivery_notes text
)
returns table (
  order_id uuid,
  order_reference text,
  guest_token text,
  total_cents integer,
  currency text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reservation record;
  v_order public.orders%rowtype;
  v_paid_guest_token text;
begin
  select * into v_reservation
  from private.create_checkout_reservation(
    p_painting_id,
    p_customer_user_id,
    p_customer_email,
    p_customer_first_name,
    p_customer_last_name,
    p_customer_phone,
    p_shipping_address,
    p_delivery_method,
    p_delivery_notes,
    0,
    30
  );

  update public.orders
  set is_demo = true,
      payment_status = 'paid',
      order_status = 'confirmed',
      paid_at = now(),
      reservation_expires_at = null,
      guest_access_token_hash = case when p_customer_user_id is null then guest_access_token_hash else null end,
      guest_access_expires_at = case when p_customer_user_id is null then guest_access_expires_at else null end
  where id = v_reservation.order_id
  returning * into v_order;

  update public.paintings
  set status = 'sold', reserved_order_id = null, reserved_until = null
  where reserved_order_id = v_order.id and status = 'reserved';

  if not found then
    raise exception 'The painting could not be marked sold' using errcode = 'P0002';
  end if;

  insert into public.order_events (
    order_id, event_type, actor_type, customer_safe_description, internal_metadata
  ) values (
    v_order.id,
    'demo_order_confirmed',
    'system',
    'Demo order confirmed. No payment was taken.',
    jsonb_build_object('is_demo', true)
  );

  insert into public.email_outbox (order_id, template, recipient, payload, dedupe_key)
  values (
    v_order.id,
    'order_confirmation',
    v_order.customer_email,
    jsonb_build_object('order_id', v_order.id, 'is_demo', true),
    'order_confirmation:' || v_order.id::text
  ) on conflict (dedupe_key) do nothing;

  if p_customer_user_id is null then
    select e.payload ->> 'guest_token' into v_paid_guest_token
    from public.email_outbox e
    where e.order_id = v_order.id and e.template = 'order_confirmation';
  end if;

  insert into public.email_outbox (order_id, template, recipient, payload, dedupe_key)
  values (
    v_order.id,
    'admin_new_order',
    'STORE_NOTIFICATION_EMAIL',
    jsonb_build_object('order_id', v_order.id, 'is_demo', true),
    'admin_new_order:' || v_order.id::text
  ) on conflict (dedupe_key) do nothing;

  return query select
    v_order.id,
    v_order.order_reference,
    v_paid_guest_token,
    v_order.total_cents,
    v_order.currency;
end;
$$;

create or replace function public.create_demo_order(
  p_painting_id uuid,
  p_customer_user_id uuid,
  p_customer_email text,
  p_customer_first_name text,
  p_customer_last_name text,
  p_customer_phone text,
  p_shipping_address jsonb,
  p_delivery_method text,
  p_delivery_notes text
)
returns table (
  order_id uuid,
  order_reference text,
  guest_token text,
  total_cents integer,
  currency text
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.create_demo_order(
    p_painting_id, p_customer_user_id, p_customer_email,
    p_customer_first_name, p_customer_last_name, p_customer_phone,
    p_shipping_address, p_delivery_method, p_delivery_notes
  );
$$;

create or replace function private.process_demo_refund(
  p_order_id uuid,
  p_amount_cents integer,
  p_reason text,
  p_idempotency_key uuid,
  p_actor_user_id uuid,
  p_cancel_order boolean default false,
  p_restock boolean default false,
  p_notify boolean default true
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_remaining integer;
  v_total_refunded integer;
  v_reference text := 'demo_' || p_idempotency_key::text;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or not v_order.is_demo then
    raise exception 'Demo order not found' using errcode = 'P0002';
  end if;
  if v_order.payment_status not in ('paid', 'partially_refunded') then
    raise exception 'Demo order is not refundable' using errcode = '22023';
  end if;
  v_remaining := v_order.total_cents - v_order.amount_refunded_cents;
  if p_amount_cents <= 0 or p_amount_cents > v_remaining then
    raise exception 'Refund exceeds the remaining payment' using errcode = '22023';
  end if;

  insert into public.refunds (
    order_id, requested_by, amount_cents, status, reason,
    restock_on_success, is_demo, demo_reference
  ) values (
    v_order.id, p_actor_user_id, p_amount_cents, 'succeeded', btrim(p_reason),
    p_restock, true, v_reference
  ) on conflict (demo_reference) do nothing;

  if not found then
    select * into v_order from public.orders where id = p_order_id;
    return v_order;
  end if;

  v_total_refunded := v_order.amount_refunded_cents + p_amount_cents;
  update public.orders
  set amount_refunded_cents = v_total_refunded,
      refund_status = case when v_total_refunded = total_cents then 'full' else 'partial' end,
      payment_status = case when v_total_refunded = total_cents then 'refunded' else 'partially_refunded' end,
      order_status = case when p_cancel_order or v_total_refunded = total_cents then 'refunded' else order_status end,
      fulfillment_status = case when p_cancel_order then 'cancelled' else fulfillment_status end,
      cancelled_at = case when p_cancel_order then now() else cancelled_at end,
      customer_status_message = case when p_cancel_order then btrim(p_reason) else customer_status_message end
  where id = v_order.id
  returning * into v_order;

  if p_restock and v_total_refunded = v_order.total_cents then
    update public.paintings
    set status = 'available', reserved_order_id = null, reserved_until = null
    where status in ('sold', 'reserved')
      and id in (
        select painting_id from public.order_items
        where order_id = v_order.id and painting_id is not null
      );
  end if;

  insert into public.order_events (
    order_id, event_type, actor_user_id, actor_type,
    customer_safe_description, internal_metadata
  ) values (
    v_order.id,
    case when p_cancel_order then 'demo_order_cancelled' else 'demo_refund_completed' end,
    p_actor_user_id,
    'admin',
    case when p_cancel_order then 'Order cancelled and demo refund completed.' else 'Demo refund completed.' end,
    jsonb_build_object('amount_cents', p_amount_cents, 'restocked', p_restock, 'is_demo', true)
  );

  insert into public.admin_audit_log (
    actor_user_id, action, target_type, target_id, safe_metadata
  ) values (
    p_actor_user_id,
    case when p_cancel_order then 'demo_order.cancelled' else 'demo_order.refunded' end,
    'order', v_order.id::text,
    jsonb_build_object('amount_cents', p_amount_cents, 'restocked', p_restock)
  );

  if p_notify then
    insert into public.email_outbox (order_id, template, recipient, payload, dedupe_key)
    values (
      v_order.id, 'refund_completed', v_order.customer_email,
      jsonb_build_object('order_id', v_order.id, 'is_demo', true),
      'demo_refund:' || p_idempotency_key::text
    );
  end if;
  return v_order;
end;
$$;

create or replace function public.process_demo_refund(
  p_order_id uuid,
  p_amount_cents integer,
  p_reason text,
  p_idempotency_key uuid,
  p_actor_user_id uuid,
  p_cancel_order boolean default false,
  p_restock boolean default false,
  p_notify boolean default true
)
returns public.orders
language sql
security invoker
set search_path = ''
as $$
  select private.process_demo_refund(
    p_order_id, p_amount_cents, p_reason, p_idempotency_key,
    p_actor_user_id, p_cancel_order, p_restock, p_notify
  );
$$;

create or replace function private.reset_demo_order(
  p_order_id uuid,
  p_actor_user_id uuid
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or not v_order.is_demo then
    raise exception 'Demo order not found' using errcode = 'P0002';
  end if;

  update public.refunds
  set status = 'cancelled', failure_reason = 'Demo order reset by administrator'
  where order_id = v_order.id and is_demo and status = 'succeeded';

  update public.orders
  set payment_status = 'cancelled',
      fulfillment_status = 'cancelled',
      order_status = 'cancelled',
      amount_refunded_cents = 0,
      refund_status = 'none',
      cancelled_at = now(),
      customer_status_message = 'Demo order reset. No payment was taken.'
  where id = v_order.id
  returning * into v_order;

  update public.paintings
  set status = 'available', reserved_order_id = null, reserved_until = null
  where id in (
    select painting_id from public.order_items
    where order_id = v_order.id and painting_id is not null
  );

  insert into public.order_events (
    order_id, event_type, actor_user_id, actor_type,
    customer_safe_description, internal_metadata
  ) values (
    v_order.id, 'demo_order_reset', p_actor_user_id, 'admin',
    'Demo order reset. No payment was taken.', jsonb_build_object('is_demo', true)
  );

  insert into public.admin_audit_log (
    actor_user_id, action, target_type, target_id, safe_metadata
  ) values (
    p_actor_user_id, 'demo_order.reset', 'order', v_order.id::text,
    jsonb_build_object('painting_restored', true)
  );
  return v_order;
end;
$$;

create or replace function public.reset_demo_order(
  p_order_id uuid,
  p_actor_user_id uuid
)
returns public.orders
language sql
security invoker
set search_path = ''
as $$ select private.reset_demo_order(p_order_id, p_actor_user_id); $$;

revoke all on function public.create_demo_order(uuid, uuid, text, text, text, text, jsonb, text, text)
  from public, anon, authenticated;
revoke all on function public.process_demo_refund(uuid, integer, text, uuid, uuid, boolean, boolean, boolean)
  from public, anon, authenticated;
revoke all on function public.reset_demo_order(uuid, uuid)
  from public, anon, authenticated;
revoke all on function private.create_demo_order(uuid, uuid, text, text, text, text, jsonb, text, text)
  from public, anon, authenticated;
revoke all on function private.process_demo_refund(uuid, integer, text, uuid, uuid, boolean, boolean, boolean)
  from public, anon, authenticated;
revoke all on function private.reset_demo_order(uuid, uuid)
  from public, anon, authenticated;

grant execute on function private.create_demo_order(uuid, uuid, text, text, text, text, jsonb, text, text) to service_role;
grant execute on function private.process_demo_refund(uuid, integer, text, uuid, uuid, boolean, boolean, boolean) to service_role;
grant execute on function private.reset_demo_order(uuid, uuid) to service_role;
grant execute on function public.create_demo_order(uuid, uuid, text, text, text, text, jsonb, text, text) to service_role;
grant execute on function public.process_demo_refund(uuid, integer, text, uuid, uuid, boolean, boolean, boolean) to service_role;
grant execute on function public.reset_demo_order(uuid, uuid) to service_role;
