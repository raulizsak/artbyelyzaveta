-- Replace the unavailable direct Australia Post polling integration with
-- idempotent 17TRACK registration and signed webhook processing.
-- The changes are additive so the currently deployed application remains
-- compatible while the Edge Function and Render release are rolled out.

alter table public.orders
  add column if not exists tracking_provider text,
  add column if not exists tracking_carrier_code integer,
  add column if not exists tracking_registration_status text not null default 'not_registered',
  add column if not exists tracking_registered_number text,
  add column if not exists tracking_registered_carrier_code integer,
  add column if not exists tracking_registered_at timestamptz,
  add column if not exists tracking_registration_attempted_at timestamptz,
  add column if not exists tracking_registration_error text,
  add column if not exists last_tracking_webhook_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_tracking_provider_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_tracking_provider_check
      check (tracking_provider is null or tracking_provider = '17track');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_tracking_registration_status_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_tracking_registration_status_check
      check (tracking_registration_status in (
        'not_registered', 'pending', 'registering', 'registered', 'failed', 'stopped', 'not_applicable'
      ));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_tracking_carrier_code_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_tracking_carrier_code_check
      check (tracking_carrier_code is null or tracking_carrier_code > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_tracking_registered_carrier_code_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_tracking_registered_carrier_code_check
      check (tracking_registered_carrier_code is null or tracking_registered_carrier_code > 0);
  end if;
end
$$;

create index if not exists orders_current_tracking_match_idx
  on public.orders (tracking_provider, tracking_carrier_code, upper(btrim(tracking_number)))
  where tracking_number is not null;

-- Reset only tracking automation state when the shipment identity or its
-- eligibility changes. The last registered number is retained so the
-- application can stop the superseded 17TRACK subscription after the new
-- number is accepted.
create or replace function private.prepare_tracking_registration()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_number_changed boolean := new.tracking_number is distinct from old.tracking_number
    or new.tracking_carrier is distinct from old.tracking_carrier;
  v_eligible boolean;
  v_current_registered boolean;
begin
  v_eligible := new.delivery_method = 'shipping'
    and not new.is_demo
    and new.fulfillment_status = 'shipped'
    and new.order_status not in ('cancelled', 'refunded')
    and nullif(btrim(new.tracking_number), '') is not null
    and (
      nullif(btrim(new.tracking_carrier), '') is null
      or regexp_replace(lower(btrim(new.tracking_carrier)), '[^a-z0-9]+', '', 'g')
        in ('australiapost', 'auspost')
    );
  v_current_registered := new.tracking_registration_status = 'registered'
    and upper(btrim(coalesce(new.tracking_registered_number, '')))
      = upper(btrim(coalesce(new.tracking_number, '')))
    and new.tracking_registered_carrier_code = 1151;

  if v_number_changed then
    new.tracking_status := null;
    new.latest_tracking_event := null;
    new.last_tracking_check_at := null;
    new.next_tracking_check_at := null;
    new.tracking_error := null;
    new.tracking_retry_count := 0;
    new.last_tracking_webhook_at := null;
    new.tracking_provider := case when v_eligible then '17track' else null end;
    new.tracking_carrier_code := case when v_eligible then 1151 else null end;
    new.tracking_registration_status := case when v_eligible then 'pending' else 'not_registered' end;
    new.tracking_registration_attempted_at := null;
    new.tracking_registration_error := null;
  elsif v_eligible and not v_current_registered
    and new.tracking_registration_status in ('not_registered', 'not_applicable') then
    new.tracking_provider := '17track';
    new.tracking_carrier_code := 1151;
    new.tracking_registration_status := 'pending';
    new.tracking_registration_error := null;
  elsif not v_eligible
    and new.tracking_registration_status in ('pending', 'registering', 'failed') then
    new.tracking_registration_status := 'not_applicable';
    new.tracking_registration_error := null;
  end if;

  return new;
end;
$$;

drop trigger if exists orders_prepare_tracking_registration on public.orders;
create trigger orders_prepare_tracking_registration
before update of tracking_number, tracking_carrier, delivery_method, is_demo,
  fulfillment_status, order_status
on public.orders
for each row execute function private.prepare_tracking_registration();

revoke all on function private.prepare_tracking_registration() from public, anon, authenticated;

create or replace function private.admin_claim_tracking_registration(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_number text;
  v_carrier text;
begin
  if not (select private.is_admin_aal2()) then
    raise exception 'admin_aal2_required' using errcode = '42501';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;

  v_number := upper(btrim(coalesce(v_order.tracking_number, '')));
  v_carrier := regexp_replace(lower(btrim(coalesce(v_order.tracking_carrier, ''))), '[^a-z0-9]+', '', 'g');

  if v_order.delivery_method <> 'shipping'
    or v_order.is_demo
    or v_order.fulfillment_status <> 'shipped'
    or v_order.order_status in ('cancelled', 'refunded')
    or v_number = ''
    or v_number !~ '^[A-Z0-9-]{5,50}$'
    or v_carrier not in ('', 'australiapost', 'auspost') then
    update public.orders set
      tracking_registration_status = 'not_applicable',
      tracking_registration_error = null,
      updated_at = now()
    where id = p_order_id;
    return jsonb_build_object('claimed', false, 'reason', 'not_applicable');
  end if;

  if v_order.tracking_registration_status = 'registered'
    and upper(btrim(coalesce(v_order.tracking_registered_number, ''))) = v_number
    and v_order.tracking_registered_carrier_code = 1151 then
    return jsonb_build_object('claimed', false, 'reason', 'already_registered');
  end if;

  if v_order.tracking_registration_status = 'registering'
    and v_order.tracking_registration_attempted_at > now() - interval '5 minutes' then
    return jsonb_build_object('claimed', false, 'reason', 'in_progress');
  end if;

  if v_order.tracking_registration_status = 'stopped'
    and upper(btrim(coalesce(v_order.tracking_registered_number, ''))) = v_number
    and v_order.tracking_registered_carrier_code = 1151 then
    return jsonb_build_object('claimed', false, 'reason', 'tracking_stopped');
  end if;

  update public.orders set
    tracking_provider = '17track',
    tracking_carrier_code = 1151,
    tracking_registration_status = 'registering',
    tracking_registration_attempted_at = now(),
    tracking_registration_error = null,
    updated_at = now()
  where id = p_order_id;

  return jsonb_build_object(
    'claimed', true,
    'tracking_number', v_number,
    'previous_tracking_number', v_order.tracking_registered_number,
    'previous_carrier_code', v_order.tracking_registered_carrier_code
  );
end;
$$;

create or replace function public.admin_claim_tracking_registration(p_order_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.admin_claim_tracking_registration(p_order_id); $$;

revoke all on function public.admin_claim_tracking_registration(uuid) from public, anon;
grant execute on function public.admin_claim_tracking_registration(uuid) to authenticated;

create or replace function private.admin_complete_tracking_registration(
  p_order_id uuid,
  p_tracking_number text,
  p_success boolean,
  p_error text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_number text := upper(btrim(coalesce(p_tracking_number, '')));
begin
  if not (select private.is_admin_aal2()) then
    raise exception 'admin_aal2_required' using errcode = '42501';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;

  if upper(btrim(coalesce(v_order.tracking_number, ''))) <> v_number then
    return jsonb_build_object('completed', false, 'reason', 'stale_tracking_number');
  end if;

  if p_success then
    update public.orders set
      tracking_url = coalesce(nullif(btrim(tracking_url), ''), 'https://auspost.com.au/track/' || v_number),
      tracking_provider = '17track',
      tracking_carrier_code = 1151,
      tracking_registration_status = 'registered',
      tracking_registered_number = v_number,
      tracking_registered_carrier_code = 1151,
      tracking_registered_at = now(),
      tracking_registration_error = null,
      tracking_error = null,
      updated_at = now()
    where id = p_order_id;
  else
    update public.orders set
      tracking_registration_status = 'failed',
      tracking_registration_error = nullif(left(coalesce(p_error, '17TRACK registration failed.'), 500), ''),
      updated_at = now()
    where id = p_order_id;
  end if;

  return jsonb_build_object('completed', true, 'registered', p_success);
end;
$$;

create or replace function public.admin_complete_tracking_registration(
  p_order_id uuid,
  p_tracking_number text,
  p_success boolean,
  p_error text default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.admin_complete_tracking_registration(
    p_order_id, p_tracking_number, p_success, p_error
  );
$$;

revoke all on function public.admin_complete_tracking_registration(uuid, text, boolean, text) from public, anon;
grant execute on function public.admin_complete_tracking_registration(uuid, text, boolean, text) to authenticated;

-- Match inside the database while the row is locked. This is the final guard
-- against an old tracking number racing with an administrator's correction.
create or replace function private.record_17track_webhook(
  p_tracking_number text,
  p_carrier_code integer,
  p_tracking_status text,
  p_latest_event jsonb,
  p_delivered boolean,
  p_delivered_at timestamptz,
  p_error text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_order public.orders%rowtype;
  v_result jsonb;
begin
  if p_carrier_code <> 1151 then
    return jsonb_build_object('matched', false, 'reason', 'carrier_mismatch');
  end if;

  select array_agg(id order by created_at)
  into v_ids
  from public.orders
  where tracking_provider = '17track'
    and tracking_carrier_code = 1151
    and upper(btrim(coalesce(tracking_number, ''))) = upper(btrim(coalesce(p_tracking_number, '')))
    and delivery_method = 'shipping'
    and not is_demo
    and fulfillment_status in ('shipped', 'delivered')
    and order_status not in ('cancelled', 'refunded');

  if coalesce(array_length(v_ids, 1), 0) <> 1 then
    return jsonb_build_object('matched', false, 'reason', 'not_unique_current_tracking_number');
  end if;

  select * into v_order from public.orders where id = v_ids[1] for update;
  if upper(btrim(coalesce(v_order.tracking_number, '')))
      <> upper(btrim(coalesce(p_tracking_number, '')))
    or v_order.tracking_provider <> '17track'
    or v_order.tracking_carrier_code <> 1151
    or v_order.delivery_method <> 'shipping'
    or v_order.is_demo
    or v_order.fulfillment_status not in ('shipped', 'delivered')
    or v_order.order_status in ('cancelled', 'refunded') then
    return jsonb_build_object('matched', false, 'reason', 'stale_tracking_number');
  end if;

  v_result := private.record_tracking_result(
    v_order.id,
    p_tracking_status,
    p_latest_event,
    p_delivered,
    p_delivered_at,
    p_error,
    null,
    'system',
    null
  );

  update public.orders set
    last_tracking_webhook_at = now(),
    tracking_registration_status = case when p_error is null then 'registered' else 'stopped' end,
    tracking_registered_number = coalesce(tracking_registered_number, tracking_number),
    tracking_registered_carrier_code = 1151,
    tracking_registered_at = coalesce(tracking_registered_at, now()),
    tracking_registration_error = case when p_error is null then null else left(p_error, 500) end,
    updated_at = now()
  where id = v_order.id;

  return jsonb_build_object(
    'matched', true,
    'order_id', v_order.id,
    'transitioned_to_delivered', coalesce((v_result ->> 'transitioned_to_delivered')::boolean, false)
  );
end;
$$;

create or replace function public.record_17track_webhook(
  p_tracking_number text,
  p_carrier_code integer,
  p_tracking_status text,
  p_latest_event jsonb,
  p_delivered boolean,
  p_delivered_at timestamptz,
  p_error text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.record_17track_webhook(
    p_tracking_number, p_carrier_code, p_tracking_status, p_latest_event,
    p_delivered, p_delivered_at, p_error
  );
$$;

revoke all on function public.record_17track_webhook(text, integer, text, jsonb, boolean, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.record_17track_webhook(text, integer, text, jsonb, boolean, timestamptz, text)
  to service_role;

-- Retire the direct Australia Post poller. The webhook function is deployed
-- before this migration is applied in production so there is no tracking gap.
do $$
declare
  v_job_id bigint;
begin
  if to_regclass('cron.job') is not null then
    for v_job_id in
      select jobid from cron.job
      where jobname = 'art-by-elyzaveta-tracking-hourly'
    loop
      perform cron.unschedule(v_job_id);
    end loop;
  end if;
end
$$;

drop function if exists private.invoke_tracking_check();
