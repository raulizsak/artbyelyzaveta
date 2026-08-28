-- Boutique commerce phase: shipping, Stripe catalogue reconciliation,
-- discounts, financial snapshots, and idempotent shipment tracking.
-- This migration is intentionally additive so the previous deployment remains
-- compatible while the application is rolled forward.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

alter table public.paintings
  add column if not exists shipping_cents integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'paintings_shipping_cents_check'
      and conrelid = 'public.paintings'::regclass
  ) then
    alter table public.paintings
      add constraint paintings_shipping_cents_check check (shipping_cents >= 0);
  end if;
end
$$;

alter table public.orders
  add column if not exists discount_cents integer not null default 0,
  add column if not exists amount_paid_cents integer,
  add column if not exists stripe_mode text,
  add column if not exists stripe_discount_coupon_id text,
  add column if not exists tracking_status text,
  add column if not exists latest_tracking_event jsonb,
  add column if not exists last_tracking_check_at timestamptz,
  add column if not exists next_tracking_check_at timestamptz,
  add column if not exists tracking_error text,
  add column if not exists tracking_retry_count integer not null default 0,
  add column if not exists delivered_email_queued_at timestamptz,
  add column if not exists delivered_email_sent_at timestamptz;

-- Early deployments used PostgreSQL's generated name `orders_check` for the
-- original subtotal + shipping + tax invariant. Replace either name so
-- discounts can be represented without weakening the financial validation.
alter table public.orders drop constraint if exists orders_total_cents_check;
alter table public.orders drop constraint if exists orders_check;
alter table public.orders
  add constraint orders_total_cents_check check (
    total_cents >= 0
    and discount_cents >= 0
    and discount_cents <= subtotal_cents
    and total_cents = subtotal_cents - discount_cents + shipping_cents + tax_cents
  ),
  add constraint orders_amount_paid_cents_check check (
    amount_paid_cents is null or amount_paid_cents >= 0
  ),
  add constraint orders_stripe_mode_check check (
    stripe_mode is null or stripe_mode in ('test', 'live')
  ),
  add constraint orders_latest_tracking_event_check check (
    latest_tracking_event is null or jsonb_typeof(latest_tracking_event) = 'object'
  ),
  add constraint orders_tracking_retry_count_check check (tracking_retry_count >= 0);

alter table public.order_events
  add column if not exists dedupe_key text;

create unique index if not exists order_events_dedupe_key_unique
  on public.order_events (dedupe_key)
  where dedupe_key is not null;

create table public.painting_stripe_catalog (
  id uuid primary key default gen_random_uuid(),
  painting_id uuid not null references public.paintings (id) on delete cascade,
  mode text not null check (mode in ('test', 'live')),
  stripe_product_id text,
  stripe_price_id text,
  synced_price_cents integer check (synced_price_cents is null or synced_price_cents >= 0),
  synced_currency text check (synced_currency is null or synced_currency ~ '^[A-Z]{3}$'),
  sync_status text not null default 'pending' check (sync_status in ('pending', 'synced', 'inactive', 'error')),
  sync_error text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (painting_id, mode),
  unique (mode, stripe_product_id),
  unique (mode, stripe_price_id)
);

create table public.discounts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (
    code = upper(btrim(code))
    and code ~ '^[A-Z0-9][A-Z0-9_-]{2,39}$'
  ),
  discount_type text not null check (discount_type in ('percentage', 'fixed_amount')),
  percent_off numeric(5,2),
  amount_off_cents integer,
  applies_to text not null default 'all' check (applies_to in ('all', 'specific')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  max_redemptions integer,
  one_use_per_customer boolean not null default false,
  minimum_subtotal_cents integer,
  combinable boolean not null default false,
  active boolean not null default true,
  version integer not null default 1 check (version > 0),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint discounts_value_check check (
    (discount_type = 'percentage' and percent_off > 0 and percent_off <= 100 and amount_off_cents is null)
    or
    (discount_type = 'fixed_amount' and amount_off_cents > 0 and percent_off is null)
  ),
  constraint discounts_dates_check check (ends_at is null or ends_at > starts_at),
  constraint discounts_limits_check check (
    (max_redemptions is null or max_redemptions > 0)
    and (minimum_subtotal_cents is null or minimum_subtotal_cents >= 0)
  )
);

create table public.discount_products (
  discount_id uuid not null references public.discounts (id) on delete cascade,
  painting_id uuid not null references public.paintings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (discount_id, painting_id)
);

create table public.discount_stripe_catalog (
  id uuid primary key default gen_random_uuid(),
  discount_id uuid not null references public.discounts (id) on delete cascade,
  mode text not null check (mode in ('test', 'live')),
  version integer not null check (version > 0),
  stripe_coupon_id text,
  stripe_promotion_code_id text,
  sync_status text not null default 'pending' check (sync_status in ('pending', 'synced', 'inactive', 'error')),
  sync_error text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (discount_id, mode, version),
  unique (mode, stripe_coupon_id),
  unique (mode, stripe_promotion_code_id)
);

create table public.order_discounts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  discount_id uuid references public.discounts (id) on delete set null,
  code text not null,
  discount_type text not null check (discount_type in ('percentage', 'fixed_amount')),
  percent_off numeric(5,2),
  configured_amount_cents integer,
  applied_cents integer not null check (applied_cents >= 0),
  stripe_coupon_id text,
  created_at timestamptz not null default now(),
  unique (order_id, code)
);

create table public.discount_redemptions (
  id uuid primary key default gen_random_uuid(),
  discount_id uuid not null references public.discounts (id) on delete restrict,
  order_id uuid not null references public.orders (id) on delete restrict,
  normalized_email text not null,
  customer_limited boolean not null default false,
  status text not null default 'reserved' check (status in ('reserved', 'confirmed', 'released')),
  reserved_until timestamptz not null,
  confirmed_at timestamptz,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  unique (discount_id, order_id)
);

create unique index discount_redemptions_customer_once
  on public.discount_redemptions (discount_id, normalized_email)
  where customer_limited and status in ('reserved', 'confirmed');

create index painting_stripe_catalog_painting_idx
  on public.painting_stripe_catalog (painting_id, mode);
create index discounts_active_dates_idx
  on public.discounts (active, starts_at, ends_at) where archived_at is null;
create index discount_products_painting_idx
  on public.discount_products (painting_id, discount_id);
create index discount_redemptions_usage_idx
  on public.discount_redemptions (discount_id, status);
create index discount_redemptions_order_idx
  on public.discount_redemptions (order_id);
create index order_discounts_order_idx
  on public.order_discounts (order_id);
create index orders_tracking_due_idx
  on public.orders (next_tracking_check_at, created_at)
  where fulfillment_status = 'shipped' and tracking_number is not null;

alter table public.painting_stripe_catalog enable row level security;
alter table public.discounts enable row level security;
alter table public.discount_products enable row level security;
alter table public.discount_stripe_catalog enable row level security;
alter table public.order_discounts enable row level security;
alter table public.discount_redemptions enable row level security;

create policy painting_stripe_catalog_admin_select on public.painting_stripe_catalog
for select to authenticated using ((select private.is_admin_aal2()));
create policy discounts_admin_select on public.discounts
for select to authenticated using ((select private.is_admin_aal2()));
create policy discount_products_admin_select on public.discount_products
for select to authenticated using ((select private.is_admin_aal2()));
create policy discount_stripe_catalog_admin_select on public.discount_stripe_catalog
for select to authenticated using ((select private.is_admin_aal2()));
create policy order_discounts_owner_select on public.order_discounts
for select to authenticated using (
  exists (
    select 1 from public.orders o
    where o.id = order_discounts.order_id
      and (o.customer_user_id = (select auth.uid()) or (select private.is_admin_aal2()))
  )
);
create policy discount_redemptions_admin_select on public.discount_redemptions
for select to authenticated using ((select private.is_admin_aal2()));

-- Reserve one or more one-of-a-kind paintings and calculate all monetary
-- values while the painting and discount rows are locked. Percentage codes are
-- applied first in code order against their eligible artwork subtotal; fixed
-- codes follow in code order. Shipping is never part of the discount base.
create or replace function private.create_commerce_checkout(
  p_painting_ids uuid[],
  p_customer_user_id uuid,
  p_customer_email text,
  p_customer_first_name text,
  p_customer_last_name text,
  p_customer_phone text,
  p_shipping_address jsonb,
  p_delivery_method text,
  p_delivery_notes text,
  p_discount_codes text[] default '{}'::text[],
  p_reservation_minutes integer default 30
)
returns table (
  order_id uuid,
  order_reference text,
  guest_token text,
  subtotal_cents integer,
  discount_cents integer,
  shipping_cents integer,
  tax_cents integer,
  total_cents integer,
  currency text,
  reservation_expires_at timestamptz,
  items jsonb,
  discounts jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_painting public.paintings%rowtype;
  v_discount public.discounts%rowtype;
  v_order_id uuid := gen_random_uuid();
  v_order_reference text := private.generate_order_reference();
  v_guest_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_expires_at timestamptz := now() + make_interval(mins => greatest(5, least(p_reservation_minutes, 120)));
  v_subtotal integer := 0;
  v_shipping integer := 0;
  v_discount_total integer := 0;
  v_remaining integer;
  v_currency text;
  v_painting_count integer := 0;
  v_requested_count integer;
  v_code_count integer := 0;
  v_found_codes integer := 0;
  v_eligible_subtotal integer;
  v_redemptions integer;
  v_applied integer;
  v_discount_lines jsonb := '[]'::jsonb;
  v_items jsonb := '[]'::jsonb;
  v_normalized_email text := lower(btrim(p_customer_email));
  v_updated integer;
begin
  if p_customer_email is null or p_customer_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'customer_email_invalid' using errcode = '22023';
  end if;
  if p_customer_first_name is null or btrim(p_customer_first_name) = ''
     or p_customer_last_name is null or btrim(p_customer_last_name) = '' then
    raise exception 'customer_name_required' using errcode = '22023';
  end if;
  if p_delivery_method not in ('shipping', 'collection', 'manual_arrangement') then
    raise exception 'delivery_method_invalid' using errcode = '22023';
  end if;
  if coalesce(array_length(p_painting_ids, 1), 0) = 0 then
    raise exception 'painting_required' using errcode = '22023';
  end if;

  select count(distinct painting_id)::integer
  into v_requested_count
  from unnest(p_painting_ids) as requested(painting_id);

  if v_requested_count <> array_length(p_painting_ids, 1) then
    raise exception 'duplicate_painting' using errcode = '22023';
  end if;

  for v_painting in
    select p.*
    from public.paintings p
    where p.id = any(p_painting_ids)
    order by p.id
    for update
  loop
    v_painting_count := v_painting_count + 1;

    if v_painting.status = 'reserved' and v_painting.reserved_until <= now() then
      perform private.release_checkout_reservation(v_painting.reserved_order_id, 'Reservation expired');
      select * into v_painting from public.paintings where id = v_painting.id;
    end if;

    if v_painting.published_at is null or v_painting.status <> 'available' then
      raise exception 'painting_unavailable' using errcode = 'P0002';
    end if;

    if v_currency is null then
      v_currency := v_painting.currency;
    elsif v_currency <> v_painting.currency then
      raise exception 'mixed_currency_not_supported' using errcode = '22023';
    end if;

    v_subtotal := v_subtotal + v_painting.price_cents;
    if p_delivery_method = 'shipping' then
      v_shipping := v_shipping + v_painting.shipping_cents;
    end if;
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'painting_id', v_painting.id,
      'title', v_painting.title,
      'price_cents', v_painting.price_cents,
      'shipping_cents', case when p_delivery_method = 'shipping' then v_painting.shipping_cents else 0 end
    ));
  end loop;

  if v_painting_count <> v_requested_count then
    raise exception 'painting_unavailable' using errcode = 'P0002';
  end if;

  select count(*)::integer into v_code_count
  from (
    select distinct upper(btrim(value)) as code
    from unnest(coalesce(p_discount_codes, '{}'::text[])) as entered(value)
    where btrim(value) <> ''
  ) normalized;

  for v_discount in
    select d.*
    from public.discounts d
    where d.code in (
      select distinct upper(btrim(value))
      from unnest(coalesce(p_discount_codes, '{}'::text[])) as entered(value)
      where btrim(value) <> ''
    )
    order by d.code
    for update
  loop
    v_found_codes := v_found_codes + 1;
    if not v_discount.active or v_discount.archived_at is not null then
      raise exception 'discount_invalid' using errcode = 'P0001';
    end if;
    if v_discount.starts_at > now() then
      raise exception 'discount_not_started' using errcode = 'P0001';
    end if;
    if v_discount.ends_at is not null and v_discount.ends_at <= now() then
      raise exception 'discount_expired' using errcode = 'P0001';
    end if;
    if v_discount.minimum_subtotal_cents is not null
       and v_subtotal < v_discount.minimum_subtotal_cents then
      raise exception 'discount_minimum_not_met' using errcode = 'P0001';
    end if;

    if v_discount.applies_to = 'all' then
      v_eligible_subtotal := v_subtotal;
    else
      select coalesce(sum(p.price_cents), 0)::integer
      into v_eligible_subtotal
      from public.paintings p
      join public.discount_products dp on dp.painting_id = p.id
      where dp.discount_id = v_discount.id
        and p.id = any(p_painting_ids);
    end if;
    if v_eligible_subtotal = 0 then
      raise exception 'discount_not_applicable' using errcode = 'P0001';
    end if;

    select count(*)::integer into v_redemptions
    from public.discount_redemptions dr
    where dr.discount_id = v_discount.id
      and dr.status in ('reserved', 'confirmed');
    if v_discount.max_redemptions is not null and v_redemptions >= v_discount.max_redemptions then
      raise exception 'discount_usage_limit' using errcode = 'P0001';
    end if;
    if v_discount.one_use_per_customer and exists (
      select 1 from public.discount_redemptions dr
      where dr.discount_id = v_discount.id
        and dr.normalized_email = v_normalized_email
        and dr.status in ('reserved', 'confirmed')
    ) then
      raise exception 'discount_customer_limit' using errcode = 'P0001';
    end if;
  end loop;

  if v_found_codes <> v_code_count then
    raise exception 'discount_invalid' using errcode = 'P0001';
  end if;
  if v_code_count > 1 and exists (
    select 1 from public.discounts d
    where d.code in (
      select distinct upper(btrim(value))
      from unnest(coalesce(p_discount_codes, '{}'::text[])) as entered(value)
      where btrim(value) <> ''
    ) and not d.combinable
  ) then
    raise exception 'discount_not_combinable' using errcode = 'P0001';
  end if;

  v_remaining := v_subtotal;
  for v_discount in
    select d.*
    from public.discounts d
    where d.code in (
      select distinct upper(btrim(value))
      from unnest(coalesce(p_discount_codes, '{}'::text[])) as entered(value)
      where btrim(value) <> ''
    )
    order by case d.discount_type when 'percentage' then 0 else 1 end, d.code
  loop
    if v_discount.applies_to = 'all' then
      v_eligible_subtotal := v_subtotal;
    else
      select coalesce(sum(p.price_cents), 0)::integer
      into v_eligible_subtotal
      from public.paintings p
      join public.discount_products dp on dp.painting_id = p.id
      where dp.discount_id = v_discount.id
        and p.id = any(p_painting_ids);
    end if;

    if v_discount.discount_type = 'percentage' then
      v_applied := floor(v_eligible_subtotal * v_discount.percent_off / 100)::integer;
    else
      v_applied := least(v_eligible_subtotal, v_discount.amount_off_cents);
    end if;
    v_applied := greatest(0, least(v_remaining, v_applied));
    v_remaining := v_remaining - v_applied;
    v_discount_total := v_discount_total + v_applied;
    v_discount_lines := v_discount_lines || jsonb_build_array(jsonb_build_object(
      'discount_id', v_discount.id,
      'code', v_discount.code,
      'discount_type', v_discount.discount_type,
      'percent_off', v_discount.percent_off,
      'configured_amount_cents', v_discount.amount_off_cents,
      'applied_cents', v_applied
    ));
  end loop;

  insert into public.orders (
    id, order_reference, customer_user_id, customer_email,
    customer_first_name, customer_last_name, customer_phone,
    shipping_address, delivery_method, delivery_notes,
    subtotal_cents, discount_cents, shipping_cents, tax_cents, total_cents, currency,
    guest_access_token_hash, guest_access_expires_at, reservation_expires_at
  ) values (
    v_order_id, v_order_reference, p_customer_user_id, v_normalized_email,
    btrim(p_customer_first_name), btrim(p_customer_last_name), nullif(btrim(p_customer_phone), ''),
    coalesce(p_shipping_address, '{}'::jsonb), p_delivery_method, nullif(btrim(p_delivery_notes), ''),
    v_subtotal, v_discount_total, v_shipping, 0, v_subtotal - v_discount_total + v_shipping, v_currency,
    extensions.digest(convert_to(v_guest_token, 'UTF8'), 'sha256'), now() + interval '30 days', v_expires_at
  );

  insert into public.order_items (
    order_id, painting_id, painting_slug, title, image_path, dimensions, medium,
    quantity, unit_price_cents, line_total_cents
  )
  select
    v_order_id, p.id, p.slug, p.title,
    (
      select pm.storage_path from public.painting_media pm
      where pm.painting_id = p.id and pm.kind = 'artwork' and pm.variant in ('card', 'main')
      order by case pm.variant when 'card' then 0 else 1 end, pm.position limit 1
    ),
    concat_ws(' × ', p.width_cm, p.height_cm, p.depth_cm) || ' cm',
    p.medium, 1, p.price_cents, p.price_cents
  from public.paintings p
  where p.id = any(p_painting_ids);

  insert into public.order_discounts (
    order_id, discount_id, code, discount_type, percent_off,
    configured_amount_cents, applied_cents
  )
  select
    v_order_id,
    (line ->> 'discount_id')::uuid,
    line ->> 'code',
    line ->> 'discount_type',
    nullif(line ->> 'percent_off', '')::numeric,
    nullif(line ->> 'configured_amount_cents', '')::integer,
    (line ->> 'applied_cents')::integer
  from jsonb_array_elements(v_discount_lines) as lines(line);

  insert into public.discount_redemptions (
    discount_id, order_id, normalized_email, customer_limited, reserved_until
  )
  select d.id, v_order_id, v_normalized_email, d.one_use_per_customer, v_expires_at
  from public.discounts d
  join public.order_discounts od on od.discount_id = d.id
  where od.order_id = v_order_id;

  update public.paintings
  set status = 'reserved', reserved_order_id = v_order_id, reserved_until = v_expires_at
  where id = any(p_painting_ids) and status = 'available';
  get diagnostics v_updated = row_count;
  if v_updated <> v_painting_count then
    raise exception 'painting_unavailable' using errcode = 'P0002';
  end if;

  insert into public.order_events (
    order_id, event_type, actor_type, customer_safe_description, internal_metadata, dedupe_key
  ) values (
    v_order_id, 'order_reserved', 'system', 'Checkout started.',
    jsonb_build_object('reservation_expires_at', v_expires_at, 'discount_codes', p_discount_codes),
    'order_reserved:' || v_order_id::text
  );

  return query select
    v_order_id, v_order_reference, v_guest_token, v_subtotal, v_discount_total,
    v_shipping, 0, v_subtotal - v_discount_total + v_shipping, v_currency,
    v_expires_at, v_items, v_discount_lines;
end;
$$;

create or replace function public.create_commerce_checkout(
  p_painting_ids uuid[],
  p_customer_user_id uuid,
  p_customer_email text,
  p_customer_first_name text,
  p_customer_last_name text,
  p_customer_phone text,
  p_shipping_address jsonb,
  p_delivery_method text,
  p_delivery_notes text,
  p_discount_codes text[] default '{}'::text[],
  p_reservation_minutes integer default 30
)
returns table (
  order_id uuid,
  order_reference text,
  guest_token text,
  subtotal_cents integer,
  discount_cents integer,
  shipping_cents integer,
  tax_cents integer,
  total_cents integer,
  currency text,
  reservation_expires_at timestamptz,
  items jsonb,
  discounts jsonb
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.create_commerce_checkout(
    p_painting_ids, p_customer_user_id, p_customer_email, p_customer_first_name,
    p_customer_last_name, p_customer_phone, p_shipping_address, p_delivery_method,
    p_delivery_notes, p_discount_codes, p_reservation_minutes
  );
$$;

create or replace function private.release_checkout_reservation(
  p_order_id uuid,
  p_reason text default 'Checkout cancelled'
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_released boolean := false;
begin
  update public.paintings
  set status = 'available', reserved_order_id = null, reserved_until = null
  where reserved_order_id = p_order_id and status = 'reserved';
  v_released := found;

  update public.discount_redemptions
  set status = 'released', released_at = coalesce(released_at, now())
  where order_id = p_order_id and status = 'reserved';

  update public.orders
  set payment_status = case when payment_status in ('pending', 'processing', 'failed') then 'cancelled' else payment_status end,
      order_status = case when order_status = 'pending' then 'cancelled' else order_status end,
      cancelled_at = case when order_status = 'pending' then now() else cancelled_at end,
      updated_at = now()
  where id = p_order_id and payment_status <> 'paid';

  if v_released then
    insert into public.order_events (
      order_id, event_type, actor_type, customer_safe_description, internal_metadata, dedupe_key
    ) values (
      p_order_id, 'reservation_released', 'system', 'Checkout reservation ended.',
      jsonb_build_object('reason', left(p_reason, 200)),
      'reservation_released:' || p_order_id::text
    ) on conflict (dedupe_key) where dedupe_key is not null do nothing;
  end if;
  return v_released;
end;
$$;

create or replace function private.attach_commerce_checkout_session(
  p_order_id uuid,
  p_session_id text,
  p_mode text,
  p_discount_coupon_id text default null,
  p_payment_intent_id text default null,
  p_stripe_customer_id text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_mode not in ('test', 'live') then
    raise exception 'stripe_mode_invalid' using errcode = '22023';
  end if;
  update public.orders
  set stripe_checkout_session_id = p_session_id,
      stripe_mode = p_mode,
      stripe_discount_coupon_id = p_discount_coupon_id,
      stripe_payment_intent_id = coalesce(p_payment_intent_id, stripe_payment_intent_id),
      stripe_customer_id = coalesce(p_stripe_customer_id, stripe_customer_id),
      updated_at = now()
  where id = p_order_id
    and payment_status in ('pending', 'processing')
    and reservation_expires_at > now();
  if not found then
    raise exception 'reservation_inactive' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.attach_commerce_checkout_session(
  p_order_id uuid,
  p_session_id text,
  p_mode text,
  p_discount_coupon_id text default null,
  p_payment_intent_id text default null,
  p_stripe_customer_id text default null
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.attach_commerce_checkout_session(
    p_order_id, p_session_id, p_mode, p_discount_coupon_id,
    p_payment_intent_id, p_stripe_customer_id
  );
$$;

-- Validate Stripe's authoritative totals before invoking the existing
-- idempotent payment/refund state machine, then persist actual paid values.
create or replace function private.process_commerce_stripe_event(
  p_event_id text,
  p_event_type text,
  p_mode text,
  p_data jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_order_id uuid;
  v_result jsonb;
  v_amount integer;
  v_discount integer;
  v_shipping integer;
begin
  if p_mode not in ('test', 'live') then
    return jsonb_build_object('status', 'failed', 'reason', 'stripe_mode_invalid');
  end if;
  begin
    v_order_id := nullif(p_data ->> 'order_id', '')::uuid;
  exception when invalid_text_representation then
    v_order_id := null;
  end;

  select * into v_order from public.orders
  where (v_order_id is not null and id = v_order_id)
     or (nullif(p_data ->> 'session_id', '') is not null and stripe_checkout_session_id = p_data ->> 'session_id')
     or (nullif(p_data ->> 'payment_intent_id', '') is not null and stripe_payment_intent_id = p_data ->> 'payment_intent_id')
  order by case when id = v_order_id then 0 else 1 end
  limit 1 for update;

  if v_order.id is not null and p_event_type in (
    'checkout.session.completed', 'checkout.session.async_payment_succeeded', 'payment_intent.succeeded'
  ) then
    v_amount := nullif(p_data ->> 'amount_total', '')::integer;
    v_discount := nullif(p_data ->> 'amount_discount', '')::integer;
    v_shipping := nullif(p_data ->> 'amount_shipping', '')::integer;
    if (v_amount is not null and v_amount <> v_order.total_cents)
       or (v_discount is not null and v_discount <> v_order.discount_cents)
       or (v_shipping is not null and v_shipping <> v_order.shipping_cents)
       or (nullif(p_data ->> 'currency', '') is not null and upper(p_data ->> 'currency') <> v_order.currency)
       or (v_order.stripe_mode is not null and v_order.stripe_mode <> p_mode) then
      insert into public.stripe_events (stripe_event_id, event_type, status, result, processed_at)
      values (p_event_id, p_event_type, 'failed', jsonb_build_object('reason', 'financial_snapshot_mismatch'), now())
      on conflict (stripe_event_id) do nothing;
      return jsonb_build_object('status', 'failed', 'reason', 'financial_snapshot_mismatch');
    end if;
  end if;

  v_result := private.process_stripe_event(p_event_id, p_event_type, p_data);

  if v_order.id is not null and v_result ->> 'status' = 'processed' then
    if p_event_type in (
      'checkout.session.completed', 'checkout.session.async_payment_succeeded', 'payment_intent.succeeded'
    ) and (p_event_type <> 'checkout.session.completed' or coalesce(p_data ->> 'payment_status', '') = 'paid') then
      update public.orders
      set amount_paid_cents = coalesce(nullif(p_data ->> 'amount_total', '')::integer, total_cents),
          stripe_mode = coalesce(stripe_mode, p_mode),
          updated_at = now()
      where id = v_order.id;
      update public.discount_redemptions
      set status = 'confirmed', confirmed_at = coalesce(confirmed_at, now())
      where order_id = v_order.id and status = 'reserved';
    end if;
  end if;
  return v_result;
end;
$$;

create or replace function public.process_commerce_stripe_event(
  p_event_id text,
  p_event_type text,
  p_mode text,
  p_data jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.process_commerce_stripe_event(p_event_id, p_event_type, p_mode, p_data); $$;

-- One atomic transition for both the Australia Post worker and the admin
-- fallback. The outbox's unique key is the final guard against duplicate mail.
create or replace function private.record_tracking_result(
  p_order_id uuid,
  p_tracking_status text,
  p_latest_event jsonb,
  p_delivered boolean,
  p_delivered_at timestamptz,
  p_error text,
  p_next_check_at timestamptz,
  p_actor_type text default 'system',
  p_actor_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_transitioned boolean := false;
begin
  if p_actor_type not in ('admin', 'system') then
    raise exception 'tracking_actor_invalid' using errcode = '22023';
  end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found' using errcode = 'P0002'; end if;

  update public.orders set
    tracking_status = coalesce(nullif(btrim(p_tracking_status), ''), tracking_status),
    latest_tracking_event = coalesce(p_latest_event, latest_tracking_event),
    last_tracking_check_at = now(),
    next_tracking_check_at = case when p_delivered then null else p_next_check_at end,
    tracking_error = nullif(left(coalesce(p_error, ''), 500), ''),
    tracking_retry_count = case when p_error is null then 0 else tracking_retry_count + 1 end,
    updated_at = now()
  where id = p_order_id;

  if p_delivered and v_order.fulfillment_status <> 'delivered' then
    update public.orders set
      fulfillment_status = 'delivered',
      order_status = case when order_status in ('confirmed', 'delayed') then 'completed' else order_status end,
      delivered_at = coalesce(delivered_at, p_delivered_at, now()),
      delivered_email_queued_at = coalesce(delivered_email_queued_at, now()),
      tracking_error = null,
      next_tracking_check_at = null,
      updated_at = now()
    where id = p_order_id;
    v_transitioned := true;

    insert into public.order_events (
      order_id, event_type, actor_user_id, actor_type,
      customer_safe_description, internal_metadata, dedupe_key
    ) values (
      p_order_id, 'delivered', p_actor_user_id, p_actor_type,
      'Your artwork has been delivered.',
      jsonb_build_object('tracking_status', p_tracking_status, 'latest_event', p_latest_event),
      'delivered:' || p_order_id::text
    ) on conflict (dedupe_key) where dedupe_key is not null do nothing;

    insert into public.email_outbox (order_id, template, recipient, payload, dedupe_key)
    values (
      p_order_id, 'delivered', v_order.customer_email,
      jsonb_build_object('order_id', p_order_id), 'delivered:' || p_order_id::text
    ) on conflict (dedupe_key) do nothing;
  end if;

  return jsonb_build_object('status', 'processed', 'transitioned_to_delivered', v_transitioned);
end;
$$;

create or replace function public.record_tracking_result(
  p_order_id uuid,
  p_tracking_status text,
  p_latest_event jsonb,
  p_delivered boolean,
  p_delivered_at timestamptz,
  p_error text,
  p_next_check_at timestamptz
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.record_tracking_result(
    p_order_id, p_tracking_status, p_latest_event, p_delivered,
    p_delivered_at, p_error, p_next_check_at, 'system', null
  );
$$;

create or replace function public.admin_mark_order_delivered(
  p_order_id uuid,
  p_tracking_status text default 'Delivered',
  p_latest_event jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin_aal2() then
    raise exception 'AAL2 administrator access required' using errcode = '42501';
  end if;
  return private.record_tracking_result(
    p_order_id, p_tracking_status, p_latest_event, true, now(), null, null,
    'admin', auth.uid()
  );
end;
$$;

create or replace function public.admin_reorder_painting_media(
  p_painting_id uuid,
  p_group_keys text[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing integer;
  v_requested integer;
begin
  if not private.is_admin_aal2() then
    raise exception 'AAL2 administrator access required' using errcode = '42501';
  end if;
  select count(distinct regexp_replace(storage_path, '/[^/]+$', ''))::integer
  into v_existing
  from public.painting_media where painting_id = p_painting_id;
  select count(distinct key)::integer into v_requested
  from unnest(p_group_keys) as requested(key);
  if v_existing <> v_requested or v_requested <> coalesce(array_length(p_group_keys, 1), 0) then
    raise exception 'media_order_invalid' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(p_group_keys) as requested(key)
    where not exists (
      select 1 from public.painting_media pm
      where pm.painting_id = p_painting_id
        and regexp_replace(pm.storage_path, '/[^/]+$', '') = requested.key
    )
  ) then
    raise exception 'media_order_invalid' using errcode = '22023';
  end if;

  update public.painting_media
  set position = position + 100000
  where painting_id = p_painting_id;

  update public.painting_media pm
  set position = ordered.ordinality - 1,
      kind = case when ordered.ordinality = 1 then 'artwork' else 'room' end
  from unnest(p_group_keys) with ordinality as ordered(group_key, ordinality)
  where pm.painting_id = p_painting_id
    and regexp_replace(pm.storage_path, '/[^/]+$', '') = ordered.group_key;
end;
$$;

create or replace function public.admin_save_discount(
  p_discount_id uuid,
  p_code text,
  p_discount_type text,
  p_percent_off numeric,
  p_amount_off_cents integer,
  p_applies_to text,
  p_painting_ids uuid[],
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_max_redemptions integer,
  p_one_use_per_customer boolean,
  p_minimum_subtotal_cents integer,
  p_combinable boolean,
  p_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current public.discounts%rowtype;
  v_id uuid := coalesce(p_discount_id, gen_random_uuid());
  v_version integer := 1;
  v_material_change boolean := true;
begin
  if not private.is_admin_aal2() then
    raise exception 'AAL2 administrator access required' using errcode = '42501';
  end if;
  if p_applies_to = 'specific' and coalesce(array_length(p_painting_ids, 1), 0) = 0 then
    raise exception 'discount_products_required' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(coalesce(p_painting_ids, '{}'::uuid[])) selected(id)
    where not exists (select 1 from public.paintings p where p.id = selected.id)
  ) then
    raise exception 'discount_product_invalid' using errcode = '22023';
  end if;

  if p_discount_id is not null then
    select * into v_current from public.discounts where id = p_discount_id for update;
    if not found then raise exception 'discount_not_found' using errcode = 'P0002'; end if;
    select
      v_current.code is distinct from p_code
      or v_current.discount_type is distinct from p_discount_type
      or v_current.percent_off is distinct from p_percent_off
      or v_current.amount_off_cents is distinct from p_amount_off_cents
      or v_current.applies_to is distinct from p_applies_to
      or v_current.starts_at is distinct from p_starts_at
      or v_current.ends_at is distinct from p_ends_at
      or v_current.max_redemptions is distinct from p_max_redemptions
      or v_current.one_use_per_customer is distinct from p_one_use_per_customer
      or v_current.minimum_subtotal_cents is distinct from p_minimum_subtotal_cents
      or v_current.combinable is distinct from p_combinable
      or exists (
        (select painting_id from public.discount_products where discount_id = p_discount_id)
        except
        (select id from unnest(coalesce(p_painting_ids, '{}'::uuid[])) selected(id))
      )
      or exists (
        (select id from unnest(coalesce(p_painting_ids, '{}'::uuid[])) selected(id))
        except
        (select painting_id from public.discount_products where discount_id = p_discount_id)
      )
    into v_material_change;
    v_version := v_current.version + case when v_material_change then 1 else 0 end;
    update public.discounts set
      code = p_code,
      discount_type = p_discount_type,
      percent_off = p_percent_off,
      amount_off_cents = p_amount_off_cents,
      applies_to = p_applies_to,
      starts_at = p_starts_at,
      ends_at = p_ends_at,
      max_redemptions = p_max_redemptions,
      one_use_per_customer = p_one_use_per_customer,
      minimum_subtotal_cents = p_minimum_subtotal_cents,
      combinable = p_combinable,
      active = p_active,
      version = v_version,
      updated_at = now()
    where id = p_discount_id;
  else
    insert into public.discounts (
      id, code, discount_type, percent_off, amount_off_cents, applies_to,
      starts_at, ends_at, max_redemptions, one_use_per_customer,
      minimum_subtotal_cents, combinable, active
    ) values (
      v_id, p_code, p_discount_type, p_percent_off, p_amount_off_cents, p_applies_to,
      p_starts_at, p_ends_at, p_max_redemptions, p_one_use_per_customer,
      p_minimum_subtotal_cents, p_combinable, p_active
    );
  end if;

  delete from public.discount_products where discount_id = v_id;
  if p_applies_to = 'specific' then
    insert into public.discount_products (discount_id, painting_id)
    select v_id, id from unnest(p_painting_ids) selected(id);
  end if;
  return jsonb_build_object('id', v_id, 'version', v_version, 'material_change', v_material_change);
end;
$$;

create or replace function public.admin_archive_discount(p_discount_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin_aal2() then
    raise exception 'AAL2 administrator access required' using errcode = '42501';
  end if;
  update public.discounts
  set active = false, archived_at = coalesce(archived_at, now()), updated_at = now()
  where id = p_discount_id;
  if not found then raise exception 'discount_not_found' using errcode = 'P0002'; end if;
end;
$$;

-- Replace the original workflow writer so repeated saves are harmless and a
-- shipment transition schedules tracking without emitting duplicate mail.
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
  v_before public.orders%rowtype;
  v_order public.orders%rowtype;
  v_event_id uuid := gen_random_uuid();
  v_description text;
  v_dedupe_key text;
  v_target_fulfillment text;
  v_target_order_status text;
  v_target_tracking_number text;
  v_tracking_changed boolean;
  v_changed boolean;
begin
  if not private.is_admin_aal2() then
    raise exception 'AAL2 administrator access required' using errcode = '42501';
  end if;
  if p_action not in ('fulfill', 'update', 'delay', 'cancel', 'commission_update') then
    raise exception 'Unsupported order action' using errcode = '22023';
  end if;
  select * into v_before from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;
  if p_changes ->> 'order_status' = 'cancelled' and v_before.payment_status in ('paid', 'partially_refunded') then
    raise exception 'Paid orders must use the refund workflow' using errcode = '22023';
  end if;

  v_target_fulfillment := case
    when p_changes ->> 'fulfillment_status' in ('unfulfilled', 'preparing', 'shipped', 'cancelled', 'returned')
      then p_changes ->> 'fulfillment_status'
    else v_before.fulfillment_status
  end;
  if p_changes ->> 'fulfillment_status' = 'delivered' then
    raise exception 'Use the delivered transition' using errcode = '22023';
  end if;
  v_target_order_status := case
    when p_changes ->> 'order_status' in ('pending', 'confirmed', 'delayed', 'cancelled', 'refunded', 'completed')
      then p_changes ->> 'order_status'
    else v_before.order_status
  end;
  v_target_tracking_number := case
    when p_changes ? 'tracking_number' then nullif(btrim(p_changes ->> 'tracking_number'), '')
    else v_before.tracking_number
  end;
  v_tracking_changed :=
    v_before.tracking_number is distinct from v_target_tracking_number
    or v_before.tracking_carrier is distinct from case when p_changes ? 'tracking_carrier' then nullif(btrim(p_changes ->> 'tracking_carrier'), '') else v_before.tracking_carrier end
    or v_before.tracking_url is distinct from case when p_changes ? 'tracking_url' then nullif(btrim(p_changes ->> 'tracking_url'), '') else v_before.tracking_url end;

  update public.orders set
    fulfillment_status = v_target_fulfillment,
    order_status = v_target_order_status,
    tracking_carrier = case when p_changes ? 'tracking_carrier' then nullif(btrim(p_changes ->> 'tracking_carrier'), '') else tracking_carrier end,
    tracking_number = v_target_tracking_number,
    tracking_url = case when p_changes ? 'tracking_url' then nullif(btrim(p_changes ->> 'tracking_url'), '') else tracking_url end,
    commission_eta = case when p_changes ? 'commission_eta' then nullif(p_changes ->> 'commission_eta', '')::date else commission_eta end,
    customer_status_message = case when p_changes ? 'customer_status_message' then nullif(btrim(p_changes ->> 'customer_status_message'), '') else customer_status_message end,
    internal_admin_notes = case when p_changes ? 'internal_admin_notes' then nullif(btrim(p_changes ->> 'internal_admin_notes'), '') else internal_admin_notes end,
    shipped_at = case when v_target_fulfillment = 'shipped' then coalesce(shipped_at, now()) else shipped_at end,
    tracking_status = case
      when v_target_fulfillment = 'shipped' and v_target_tracking_number is not null
        and (v_before.fulfillment_status <> 'shipped' or v_tracking_changed)
        then 'Initiated'
      else tracking_status
    end,
    next_tracking_check_at = case
      when v_target_fulfillment = 'shipped' and v_target_tracking_number is not null
        and (v_before.fulfillment_status <> 'shipped' or v_tracking_changed)
        then now()
      when v_target_fulfillment <> 'shipped' then null
      else next_tracking_check_at
    end,
    tracking_error = case when v_tracking_changed then null else tracking_error end,
    tracking_retry_count = case when v_tracking_changed then 0 else tracking_retry_count end,
    updated_at = now()
  where id = p_order_id returning * into v_order;

  v_changed :=
    v_before.fulfillment_status is distinct from v_order.fulfillment_status
    or v_before.order_status is distinct from v_order.order_status
    or v_before.tracking_carrier is distinct from v_order.tracking_carrier
    or v_before.tracking_number is distinct from v_order.tracking_number
    or v_before.tracking_url is distinct from v_order.tracking_url
    or v_before.commission_eta is distinct from v_order.commission_eta
    or v_before.customer_status_message is distinct from v_order.customer_status_message
    or v_before.internal_admin_notes is distinct from v_order.internal_admin_notes;
  if not v_changed then return v_order; end if;

  if v_order.order_status = 'cancelled' and v_before.order_status <> 'cancelled' then
    perform private.release_checkout_reservation(p_order_id, 'Cancelled by administrator');
  end if;
  v_description := case
    when v_before.fulfillment_status <> 'shipped' and v_order.fulfillment_status = 'shipped' then 'Shipment details added.'
    when v_before.fulfillment_status <> 'preparing' and v_order.fulfillment_status = 'preparing' then 'Artwork preparation started.'
    when p_action = 'delay' then 'Order timing updated.'
    when p_action = 'cancel' then 'Order cancelled.'
    when p_action = 'commission_update' then 'Commission progress updated.'
    else 'Order details updated.'
  end;
  v_dedupe_key := case
    when v_before.fulfillment_status is distinct from v_order.fulfillment_status
      then 'order-state:' || p_order_id::text || ':' || v_order.fulfillment_status
    when v_before.order_status is distinct from v_order.order_status
      then 'order-status:' || p_order_id::text || ':' || v_order.order_status
    else 'order-update:' || p_order_id::text || ':' || md5(p_changes::text)
  end;
  insert into public.order_events (
    id, order_id, event_type, actor_user_id, actor_type,
    customer_safe_description, internal_metadata, dedupe_key
  ) values (
    v_event_id, p_order_id, p_action, auth.uid(), 'admin', v_description,
    jsonb_build_object('changed_fields', (select jsonb_agg(key) from jsonb_each(p_changes))),
    v_dedupe_key
  ) on conflict (dedupe_key) where dedupe_key is not null do nothing;
  insert into public.admin_audit_log (actor_user_id, action, target_type, target_id, safe_metadata)
  values (auth.uid(), 'order.' || p_action, 'order', p_order_id::text,
    jsonb_build_object('changed_fields', (select jsonb_agg(key) from jsonb_each(p_changes))));
  if p_notify then
    insert into public.email_outbox (order_id, template, recipient, payload, dedupe_key)
    values (
      p_order_id,
      case when v_before.fulfillment_status <> 'shipped' and v_order.fulfillment_status = 'shipped' then 'shipment' else 'order_update' end,
      v_order.customer_email,
      jsonb_build_object('order_id', p_order_id, 'event_id', v_event_id),
      v_dedupe_key
    ) on conflict (dedupe_key) do nothing;
  end if;
  return v_order;
end;
$$;

revoke all on function public.create_commerce_checkout(uuid[], uuid, text, text, text, text, jsonb, text, text, text[], integer) from public, anon, authenticated;
revoke all on function public.attach_commerce_checkout_session(uuid, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.process_commerce_stripe_event(text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.record_tracking_result(uuid, text, jsonb, boolean, timestamptz, text, timestamptz) from public, anon, authenticated;
revoke all on function public.admin_mark_order_delivered(uuid, text, jsonb) from public, anon;
revoke all on function public.admin_reorder_painting_media(uuid, text[]) from public, anon;
revoke all on function public.admin_save_discount(uuid, text, text, numeric, integer, text, uuid[], timestamptz, timestamptz, integer, boolean, integer, boolean, boolean) from public, anon;
revoke all on function public.admin_archive_discount(uuid) from public, anon;
revoke all on function private.create_commerce_checkout(uuid[], uuid, text, text, text, text, jsonb, text, text, text[], integer) from public, anon, authenticated;
revoke all on function private.attach_commerce_checkout_session(uuid, text, text, text, text, text) from public, anon, authenticated;
revoke all on function private.process_commerce_stripe_event(text, text, text, jsonb) from public, anon, authenticated;
revoke all on function private.record_tracking_result(uuid, text, jsonb, boolean, timestamptz, text, timestamptz, text, uuid) from public, anon, authenticated;

grant execute on function private.create_commerce_checkout(uuid[], uuid, text, text, text, text, jsonb, text, text, text[], integer) to service_role;
grant execute on function private.attach_commerce_checkout_session(uuid, text, text, text, text, text) to service_role;
grant execute on function private.process_commerce_stripe_event(text, text, text, jsonb) to service_role;
grant execute on function private.record_tracking_result(uuid, text, jsonb, boolean, timestamptz, text, timestamptz, text, uuid) to service_role;
grant execute on function public.create_commerce_checkout(uuid[], uuid, text, text, text, text, jsonb, text, text, text[], integer) to service_role;
grant execute on function public.attach_commerce_checkout_session(uuid, text, text, text, text, text) to service_role;
grant execute on function public.process_commerce_stripe_event(text, text, text, jsonb) to service_role;
grant execute on function public.record_tracking_result(uuid, text, jsonb, boolean, timestamptz, text, timestamptz) to service_role;
grant execute on function public.admin_mark_order_delivered(uuid, text, jsonb) to authenticated;
grant execute on function public.admin_reorder_painting_media(uuid, text[]) to authenticated;
grant execute on function public.admin_save_discount(uuid, text, text, numeric, integer, text, uuid[], timestamptz, timestamptz, integer, boolean, integer, boolean, boolean) to authenticated;
grant execute on function public.admin_archive_discount(uuid) to authenticated;

grant select (shipping_cents) on public.paintings to anon, authenticated;
grant select (
  discount_cents, amount_paid_cents, stripe_mode, tracking_status,
  latest_tracking_event, last_tracking_check_at, next_tracking_check_at,
  tracking_error, tracking_retry_count, delivered_email_queued_at, delivered_email_sent_at
) on public.orders to authenticated;
grant select on public.painting_stripe_catalog, public.discounts,
  public.discount_products, public.discount_stripe_catalog,
  public.order_discounts, public.discount_redemptions to authenticated;
grant all privileges on public.painting_stripe_catalog, public.discounts,
  public.discount_products, public.discount_stripe_catalog,
  public.order_discounts, public.discount_redemptions to service_role;

-- Existing paintings begin with free shipping until Lisa sets their amount.
update public.paintings set shipping_cents = 0 where shipping_cents is null;

-- The hourly job is free on the hosted Supabase project. Its URL and shared
-- authentication secret are read from Vault and never stored in this migration.
create or replace function private.invoke_tracking_check()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url
  from vault.decrypted_secrets
  where name = 'tracking_function_url';

  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'tracking_cron_secret';

  -- The schema can be deployed before production secrets are provisioned.
  -- Until both values exist, the hourly job succeeds without making a request.
  if nullif(v_url, '') is null or nullif(v_secret, '') is null then
    return null;
  end if;

  return net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-tracking-cron-secret',
      v_secret
    ),
    body := jsonb_build_object('scheduled_at', now()),
    timeout_milliseconds := 120000
  );
end;
$$;

revoke all on function private.invoke_tracking_check() from public, anon, authenticated;

do $$
declare
  v_job_id bigint;
begin
  for v_job_id in
    select jobid from cron.job
    where jobname = 'art-by-elyzaveta-tracking-hourly'
  loop
    perform cron.unschedule(v_job_id);
  end loop;

  perform cron.schedule(
    'art-by-elyzaveta-tracking-hourly',
    '17 * * * *',
    'select private.invoke_tracking_check()'
  );
end
$$;
