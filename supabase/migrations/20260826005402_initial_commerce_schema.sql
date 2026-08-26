-- Art by Elyzaveta production commerce schema.
-- All money values are stored in the currency's smallest unit.

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public;
revoke create on schema public from public;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text,
  last_name text,
  phone text,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  stripe_customer_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.paintings (
  id uuid primary key default gen_random_uuid(),
  legacy_convex_id text unique,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 1 and 180),
  description text not null default '',
  story text not null default '',
  price_cents integer not null check (price_cents >= 0),
  currency text not null default 'AUD' check (currency ~ '^[A-Z]{3}$'),
  width_cm numeric(8,2) check (width_cm is null or width_cm > 0),
  height_cm numeric(8,2) check (height_cm is null or height_cm > 0),
  depth_cm numeric(8,2) check (depth_cm is null or depth_cm > 0),
  medium text,
  surface text,
  category text,
  orientation text check (orientation is null or orientation in ('portrait', 'landscape', 'square', 'other')),
  framed boolean not null default false,
  frame_description text,
  signed boolean not null default true,
  ready_to_hang boolean not null default true,
  certificate boolean not null default true,
  status text not null default 'draft' check (status in ('draft', 'available', 'reserved', 'sold', 'archived')),
  featured boolean not null default false,
  year integer check (year is null or year between 1900 and 2200),
  seo_title text,
  seo_description text,
  reserved_order_id uuid,
  reserved_until timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint painting_reservation_state check (
    (status = 'reserved' and reserved_order_id is not null and reserved_until is not null)
    or (status <> 'reserved' and reserved_order_id is null and reserved_until is null)
  )
);

create table public.painting_media (
  id uuid primary key default gen_random_uuid(),
  painting_id uuid not null references public.paintings (id) on delete cascade,
  kind text not null check (kind in ('artwork', 'room', 'detail')),
  storage_path text not null check (storage_path <> '' and storage_path !~ '^(https?:)?//'),
  variant text not null check (variant in ('thumbnail', 'card', 'main', 'large', 'original')),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  bytes bigint not null check (bytes > 0),
  mime_type text not null check (mime_type in ('image/avif', 'image/jpeg', 'image/png', 'image/webp')),
  alt_text text not null check (char_length(alt_text) between 1 and 300),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  unique (painting_id, kind, position, variant),
  unique (storage_path)
);

create table public.contact_enquiries (
  id uuid primary key default gen_random_uuid(),
  legacy_convex_id text unique,
  name text not null check (char_length(name) between 1 and 160),
  email text not null check (char_length(email) between 3 and 320),
  subject text not null check (char_length(subject) between 1 and 200),
  message text not null check (char_length(message) between 1 and 5000),
  consent boolean not null check (consent),
  status text not null default 'new' check (status in ('new', 'in_progress', 'closed', 'spam')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.commission_enquiries (
  id uuid primary key default gen_random_uuid(),
  legacy_convex_id text unique,
  name text not null check (char_length(name) between 1 and 160),
  email text not null check (char_length(email) between 3 and 320),
  phone text,
  subject text not null check (char_length(subject) between 1 and 200),
  dimensions text,
  budget text,
  timing text,
  inspiration text,
  notes text,
  consent boolean not null check (consent),
  status text not null default 'new' check (status in ('new', 'reviewing', 'accepted', 'declined', 'closed', 'spam')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.commission_inspiration_files (
  id uuid primary key default gen_random_uuid(),
  commission_enquiry_id uuid not null references public.commission_enquiries (id) on delete cascade,
  legacy_storage_id text unique,
  storage_path text not null unique check (storage_path <> '' and storage_path !~ '^(https?:)?//'),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  bytes bigint not null check (bytes between 1 and 8388608),
  created_at timestamptz not null default now()
);

create table public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null default 'Home' check (char_length(label) between 1 and 80),
  recipient_name text not null check (char_length(recipient_name) between 1 and 180),
  line1 text not null check (char_length(line1) between 1 and 200),
  line2 text,
  suburb text not null check (char_length(suburb) between 1 and 120),
  state text not null check (char_length(state) between 1 and 120),
  postcode text not null check (char_length(postcode) between 1 and 20),
  country text not null default 'Australia' check (char_length(country) between 2 and 100),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index customer_addresses_one_default
  on public.customer_addresses (user_id)
  where is_default;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_reference text not null unique check (order_reference ~ '^ABE-[0-9]{4}-[A-F0-9]{10}$'),
  customer_user_id uuid references auth.users (id) on delete set null,
  customer_email text not null check (char_length(customer_email) between 3 and 320),
  normalized_email text generated always as (lower(btrim(customer_email))) stored,
  customer_first_name text not null check (char_length(customer_first_name) between 1 and 100),
  customer_last_name text not null check (char_length(customer_last_name) between 1 and 100),
  customer_phone text,
  shipping_address jsonb not null default '{}'::jsonb check (jsonb_typeof(shipping_address) = 'object'),
  billing_address jsonb check (billing_address is null or jsonb_typeof(billing_address) = 'object'),
  delivery_method text not null default 'shipping' check (delivery_method in ('shipping', 'collection', 'manual_arrangement')),
  shipping_method text,
  delivery_notes text,
  order_type text not null default 'original' check (order_type in ('original', 'commission')),
  currency text not null default 'AUD' check (currency ~ '^[A-Z]{3}$'),
  subtotal_cents integer not null check (subtotal_cents >= 0),
  shipping_cents integer not null default 0 check (shipping_cents >= 0),
  tax_cents integer not null default 0 check (tax_cents >= 0),
  total_cents integer not null check (total_cents >= 0 and total_cents = subtotal_cents + shipping_cents + tax_cents),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'processing', 'paid', 'failed', 'cancelled', 'partially_refunded', 'refunded')),
  fulfillment_status text not null default 'unfulfilled' check (fulfillment_status in ('unfulfilled', 'preparing', 'shipped', 'delivered', 'cancelled', 'returned')),
  order_status text not null default 'pending' check (order_status in ('pending', 'confirmed', 'delayed', 'cancelled', 'refunded', 'completed')),
  stripe_customer_id text,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  amount_refunded_cents integer not null default 0 check (amount_refunded_cents >= 0 and amount_refunded_cents <= total_cents),
  refund_status text not null default 'none' check (refund_status in ('none', 'pending', 'partial', 'full', 'failed')),
  tracking_carrier text,
  tracking_number text,
  tracking_url text,
  shipped_at timestamptz,
  delivered_at timestamptz,
  commission_eta date,
  customer_status_message text,
  internal_admin_notes text,
  guest_access_token_hash bytea,
  guest_access_expires_at timestamptz,
  reservation_expires_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guest_access_pair check (
    (guest_access_token_hash is null and guest_access_expires_at is null)
    or (guest_access_token_hash is not null and guest_access_expires_at is not null)
  )
);

alter table public.paintings
  add constraint paintings_reserved_order_id_fkey
  foreign key (reserved_order_id) references public.orders (id) on delete set null;

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  painting_id uuid references public.paintings (id) on delete set null,
  painting_slug text not null,
  title text not null,
  image_path text,
  dimensions text,
  medium text,
  quantity integer not null default 1 check (quantity > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  line_total_cents integer not null check (line_total_cents >= 0 and line_total_cents = unit_price_cents * quantity),
  created_at timestamptz not null default now()
);

create table public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  event_type text not null,
  stripe_event_id text,
  actor_user_id uuid references auth.users (id) on delete set null,
  actor_type text not null check (actor_type in ('customer', 'admin', 'system', 'stripe')),
  customer_safe_description text not null,
  internal_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(internal_metadata) = 'object'),
  created_at timestamptz not null default now()
);

create unique index order_events_stripe_event_unique
  on public.order_events (stripe_event_id)
  where stripe_event_id is not null;

create table public.stripe_events (
  stripe_event_id text primary key,
  event_type text not null,
  status text not null default 'processing' check (status in ('processing', 'processed', 'ignored', 'failed')),
  result jsonb not null default '{}'::jsonb check (jsonb_typeof(result) = 'object'),
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  stripe_refund_id text unique,
  requested_by uuid references auth.users (id) on delete set null,
  amount_cents integer not null check (amount_cents > 0),
  status text not null default 'pending' check (status in ('pending', 'requires_action', 'succeeded', 'failed', 'cancelled')),
  reason text not null,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  stripe_payment_method_id text not null unique,
  brand text not null,
  last4 text not null check (last4 ~ '^[0-9]{4}$'),
  exp_month integer not null check (exp_month between 1 and 12),
  exp_year integer not null check (exp_year between 2020 and 2200),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index payment_methods_one_default
  on public.payment_methods (user_id)
  where is_default;

create table public.return_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  user_id uuid references auth.users (id) on delete set null,
  reason text not null check (char_length(reason) between 1 and 200),
  explanation text not null check (char_length(explanation) between 10 and 5000),
  status text not null default 'requested' check (status in ('requested', 'needs_information', 'approved', 'declined', 'awaiting_return', 'received', 'refunded', 'closed')),
  admin_response text,
  requested_refund_cents integer check (requested_refund_cents is null or requested_refund_cents >= 0),
  approved_refund_cents integer check (
    approved_refund_cents is null
    or (approved_refund_cents >= 0 and (requested_refund_cents is null or approved_refund_cents <= requested_refund_cents))
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.return_evidence (
  id uuid primary key default gen_random_uuid(),
  return_request_id uuid not null references public.return_requests (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  storage_path text not null unique check (storage_path <> '' and storage_path !~ '^(https?:)?//'),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  bytes bigint not null check (bytes between 1 and 5242880),
  created_at timestamptz not null default now()
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  invoice_reference text not null unique,
  storage_path text unique,
  version integer not null default 1 check (version > 0),
  issued_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (order_id, version)
);

create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders (id) on delete cascade,
  template text not null,
  recipient text not null check (char_length(recipient) between 3 and 320),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  dedupe_key text not null unique,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed', 'cancelled')),
  provider_message_id text,
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  next_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users (id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  safe_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(safe_metadata) = 'object'),
  created_at timestamptz not null default now()
);

create table public.rate_limit_events (
  id bigint generated by default as identity primary key,
  scope text not null,
  key_hash bytea not null,
  created_at timestamptz not null default now()
);

create index paintings_status_created_idx on public.paintings (status, created_at desc);
create index paintings_featured_status_idx on public.paintings (featured, status) where featured;
create index painting_media_painting_position_idx on public.painting_media (painting_id, position);
create index orders_customer_created_idx on public.orders (customer_user_id, created_at desc) where customer_user_id is not null;
create index orders_email_created_idx on public.orders (normalized_email, created_at desc);
create index orders_payment_created_idx on public.orders (payment_status, created_at desc);
create index orders_fulfillment_created_idx on public.orders (fulfillment_status, created_at desc);
create index orders_status_created_idx on public.orders (order_status, created_at desc);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_painting_idx on public.order_items (painting_id) where painting_id is not null;
create index order_events_order_created_idx on public.order_events (order_id, created_at);
create index refunds_order_created_idx on public.refunds (order_id, created_at desc);
create index returns_user_created_idx on public.return_requests (user_id, created_at desc) where user_id is not null;
create index returns_status_created_idx on public.return_requests (status, created_at desc);
create index returns_order_idx on public.return_requests (order_id);
create index email_outbox_pending_idx on public.email_outbox (status, next_attempt_at) where status in ('pending', 'failed');
create index contact_enquiries_status_created_idx on public.contact_enquiries (status, created_at desc);
create index commission_enquiries_status_created_idx on public.commission_enquiries (status, created_at desc);
create index rate_limit_events_lookup_idx on public.rate_limit_events (scope, key_hash, created_at desc);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function private.set_updated_at();
create trigger paintings_set_updated_at before update on public.paintings
for each row execute function private.set_updated_at();
create trigger contact_enquiries_set_updated_at before update on public.contact_enquiries
for each row execute function private.set_updated_at();
create trigger commission_enquiries_set_updated_at before update on public.commission_enquiries
for each row execute function private.set_updated_at();
create trigger customer_addresses_set_updated_at before update on public.customer_addresses
for each row execute function private.set_updated_at();
create trigger orders_set_updated_at before update on public.orders
for each row execute function private.set_updated_at();
create trigger refunds_set_updated_at before update on public.refunds
for each row execute function private.set_updated_at();
create trigger payment_methods_set_updated_at before update on public.payment_methods
for each row execute function private.set_updated_at();
create trigger return_requests_set_updated_at before update on public.return_requests
for each row execute function private.set_updated_at();
create trigger email_outbox_set_updated_at before update on public.email_outbox
for each row execute function private.set_updated_at();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, first_name, last_name, role)
  values (
    new.id,
    nullif(btrim(new.raw_user_meta_data ->> 'first_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'last_name'), ''),
    'customer'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

create or replace function private.is_admin_aal2()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin()
    and coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2';
$$;

create or replace function public.admin_access_state()
returns table (is_admin boolean, is_aal2 boolean)
language sql
stable
security invoker
set search_path = ''
as $$
  select private.is_admin(), private.is_admin_aal2();
$$;

create or replace function private.update_my_profile(
  p_first_name text,
  p_last_name text,
  p_phone text
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  update public.profiles
  set first_name = nullif(btrim(p_first_name), ''),
      last_name = nullif(btrim(p_last_name), ''),
      phone = nullif(btrim(p_phone), '')
  where id = (select auth.uid())
  returning * into v_profile;

  return v_profile;
end;
$$;

create or replace function public.update_my_profile(
  p_first_name text,
  p_last_name text,
  p_phone text default null
)
returns public.profiles
language sql
security invoker
set search_path = ''
as $$
  select private.update_my_profile(p_first_name, p_last_name, p_phone);
$$;

create or replace function private.claim_my_guest_orders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_claimed integer;
begin
  select lower(btrim(email))
  into v_email
  from auth.users
  where id = (select auth.uid())
    and email_confirmed_at is not null;

  if v_email is null then
    raise exception 'A verified email is required' using errcode = '42501';
  end if;

  update public.orders
  set customer_user_id = (select auth.uid()),
      guest_access_token_hash = null,
      guest_access_expires_at = null
  where customer_user_id is null
    and normalized_email = v_email;

  get diagnostics v_claimed = row_count;

  if v_claimed > 0 then
    insert into public.admin_audit_log (actor_user_id, action, target_type, safe_metadata)
    values ((select auth.uid()), 'guest_orders_claimed', 'customer', jsonb_build_object('count', v_claimed));
  end if;

  return v_claimed;
end;
$$;

create or replace function public.claim_my_guest_orders()
returns integer
language sql
security invoker
set search_path = ''
as $$
  select private.claim_my_guest_orders();
$$;

create or replace function private.generate_order_reference()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_reference text;
begin
  loop
    v_reference := 'ABE-' || to_char(current_date, 'YYYY') || '-' || upper(encode(extensions.gen_random_bytes(5), 'hex'));
    exit when not exists (select 1 from public.orders where order_reference = v_reference);
  end loop;
  return v_reference;
end;
$$;

create or replace function private.create_checkout_reservation(
  p_painting_id uuid,
  p_customer_user_id uuid,
  p_customer_email text,
  p_customer_first_name text,
  p_customer_last_name text,
  p_customer_phone text,
  p_shipping_address jsonb,
  p_delivery_method text,
  p_delivery_notes text,
  p_shipping_cents integer default 0,
  p_reservation_minutes integer default 30
)
returns table (
  order_id uuid,
  order_reference text,
  guest_token text,
  total_cents integer,
  currency text,
  reservation_expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_painting public.paintings%rowtype;
  v_order_id uuid := gen_random_uuid();
  v_order_reference text := private.generate_order_reference();
  v_guest_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_expires_at timestamptz := now() + make_interval(mins => greatest(5, least(p_reservation_minutes, 120)));
  v_image_path text;
begin
  if p_customer_email is null or p_customer_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'A valid email is required' using errcode = '22023';
  end if;
  if p_shipping_cents < 0 then
    raise exception 'Shipping amount cannot be negative' using errcode = '22023';
  end if;
  if p_delivery_method not in ('shipping', 'collection', 'manual_arrangement') then
    raise exception 'Invalid delivery method' using errcode = '22023';
  end if;

  select * into v_painting
  from public.paintings
  where id = p_painting_id
  for update;

  if not found or v_painting.published_at is null then
    raise exception 'Sorry, this painting is no longer available.' using errcode = 'P0002';
  end if;

  if v_painting.status = 'reserved' and v_painting.reserved_until <= now() then
    update public.orders
    set payment_status = case when payment_status = 'pending' then 'cancelled' else payment_status end,
        order_status = case when order_status = 'pending' then 'cancelled' else order_status end,
        cancelled_at = case when order_status = 'pending' then now() else cancelled_at end
    where id = v_painting.reserved_order_id
      and payment_status in ('pending', 'failed', 'cancelled');

    update public.paintings
    set status = 'available', reserved_order_id = null, reserved_until = null
    where id = v_painting.id;
    v_painting.status := 'available';
  end if;

  if v_painting.status <> 'available' then
    raise exception 'Sorry, this painting is no longer available.' using errcode = 'P0002';
  end if;

  select storage_path into v_image_path
  from public.painting_media
  where painting_id = v_painting.id
    and kind = 'artwork'
    and variant in ('card', 'main')
  order by case variant when 'card' then 0 else 1 end, position
  limit 1;

  insert into public.orders (
    id, order_reference, customer_user_id, customer_email,
    customer_first_name, customer_last_name, customer_phone,
    shipping_address, delivery_method, delivery_notes,
    subtotal_cents, shipping_cents, tax_cents, total_cents, currency,
    guest_access_token_hash, guest_access_expires_at, reservation_expires_at
  ) values (
    v_order_id, v_order_reference, p_customer_user_id, lower(btrim(p_customer_email)),
    btrim(p_customer_first_name), btrim(p_customer_last_name), nullif(btrim(p_customer_phone), ''),
    coalesce(p_shipping_address, '{}'::jsonb), p_delivery_method, nullif(btrim(p_delivery_notes), ''),
    v_painting.price_cents, p_shipping_cents, 0, v_painting.price_cents + p_shipping_cents, v_painting.currency,
    extensions.digest(convert_to(v_guest_token, 'UTF8'), 'sha256'), now() + interval '30 days', v_expires_at
  );

  insert into public.order_items (
    order_id, painting_id, painting_slug, title, image_path, dimensions, medium,
    quantity, unit_price_cents, line_total_cents
  ) values (
    v_order_id, v_painting.id, v_painting.slug, v_painting.title, v_image_path,
    concat_ws(' × ', v_painting.width_cm, v_painting.height_cm, v_painting.depth_cm) || ' cm',
    v_painting.medium, 1, v_painting.price_cents, v_painting.price_cents
  );

  update public.paintings
  set status = 'reserved', reserved_order_id = v_order_id, reserved_until = v_expires_at
  where id = v_painting.id and status = 'available';

  if not found then
    raise exception 'Sorry, this painting is no longer available.' using errcode = 'P0002';
  end if;

  insert into public.order_events (
    order_id, event_type, actor_type, customer_safe_description, internal_metadata
  ) values (
    v_order_id, 'order_reserved', 'system', 'Checkout started.',
    jsonb_build_object('reservation_expires_at', v_expires_at)
  );

  return query select
    v_order_id,
    v_order_reference,
    v_guest_token,
    v_painting.price_cents + p_shipping_cents,
    v_painting.currency,
    v_expires_at;
end;
$$;

create or replace function public.create_checkout_reservation(
  p_painting_id uuid,
  p_customer_user_id uuid,
  p_customer_email text,
  p_customer_first_name text,
  p_customer_last_name text,
  p_customer_phone text,
  p_shipping_address jsonb,
  p_delivery_method text,
  p_delivery_notes text,
  p_shipping_cents integer default 0,
  p_reservation_minutes integer default 30
)
returns table (
  order_id uuid,
  order_reference text,
  guest_token text,
  total_cents integer,
  currency text,
  reservation_expires_at timestamptz
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.create_checkout_reservation(
    p_painting_id, p_customer_user_id, p_customer_email, p_customer_first_name,
    p_customer_last_name, p_customer_phone, p_shipping_address, p_delivery_method,
    p_delivery_notes, p_shipping_cents, p_reservation_minutes
  );
$$;

create or replace function private.attach_stripe_checkout_session(
  p_order_id uuid,
  p_session_id text,
  p_payment_intent_id text default null,
  p_stripe_customer_id text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.orders
  set stripe_checkout_session_id = p_session_id,
      stripe_payment_intent_id = coalesce(p_payment_intent_id, stripe_payment_intent_id),
      stripe_customer_id = coalesce(p_stripe_customer_id, stripe_customer_id)
  where id = p_order_id
    and payment_status in ('pending', 'processing')
    and reservation_expires_at > now();

  if not found then
    raise exception 'The reservation is no longer active' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.attach_stripe_checkout_session(
  p_order_id uuid,
  p_session_id text,
  p_payment_intent_id text default null,
  p_stripe_customer_id text default null
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.attach_stripe_checkout_session(p_order_id, p_session_id, p_payment_intent_id, p_stripe_customer_id);
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
  where reserved_order_id = p_order_id
    and status = 'reserved';
  v_released := found;

  update public.orders
  set payment_status = case when payment_status in ('pending', 'processing', 'failed') then 'cancelled' else payment_status end,
      order_status = case when order_status = 'pending' then 'cancelled' else order_status end,
      cancelled_at = case when order_status = 'pending' then now() else cancelled_at end
  where id = p_order_id and payment_status <> 'paid';

  if v_released then
    insert into public.order_events (order_id, event_type, actor_type, customer_safe_description, internal_metadata)
    values (p_order_id, 'reservation_released', 'system', 'Checkout reservation ended.', jsonb_build_object('reason', left(p_reason, 200)));
  end if;
  return v_released;
end;
$$;

create or replace function public.release_checkout_reservation(
  p_order_id uuid,
  p_reason text default 'Checkout cancelled'
)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select private.release_checkout_reservation(p_order_id, p_reason);
$$;

create or replace function private.process_stripe_event(
  p_event_id text,
  p_event_type text,
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
  v_inserted boolean;
  v_amount integer;
  v_refund_id text;
  v_refund_status text;
begin
  insert into public.stripe_events (stripe_event_id, event_type)
  values (p_event_id, p_event_type)
  on conflict (stripe_event_id) do nothing;
  v_inserted := found;

  if not v_inserted then
    return jsonb_build_object('status', 'duplicate');
  end if;

  begin
    v_order_id := nullif(p_data ->> 'order_id', '')::uuid;
  exception when invalid_text_representation then
    v_order_id := null;
  end;

  select * into v_order
  from public.orders
  where (v_order_id is not null and id = v_order_id)
     or (nullif(p_data ->> 'session_id', '') is not null and stripe_checkout_session_id = p_data ->> 'session_id')
     or (nullif(p_data ->> 'payment_intent_id', '') is not null and stripe_payment_intent_id = p_data ->> 'payment_intent_id')
  order by case when id = v_order_id then 0 else 1 end
  limit 1
  for update;

  if p_event_type in ('checkout.session.completed', 'checkout.session.async_payment_succeeded', 'payment_intent.succeeded') then
    if not found then
      update public.stripe_events
      set status = 'failed', result = jsonb_build_object('reason', 'order_not_found'), processed_at = now()
      where stripe_event_id = p_event_id;
      return jsonb_build_object('status', 'failed', 'reason', 'order_not_found');
    end if;

    if p_event_type = 'checkout.session.completed' and coalesce(p_data ->> 'payment_status', '') <> 'paid' then
      update public.orders
      set payment_status = 'processing',
          stripe_payment_intent_id = coalesce(nullif(p_data ->> 'payment_intent_id', ''), stripe_payment_intent_id),
          stripe_customer_id = coalesce(nullif(p_data ->> 'customer_id', ''), stripe_customer_id)
      where id = v_order.id and payment_status = 'pending';
      update public.stripe_events set status = 'processed', result = '{"payment":"processing"}'::jsonb, processed_at = now()
      where stripe_event_id = p_event_id;
      return jsonb_build_object('status', 'processed', 'payment', 'processing');
    end if;

    v_amount := nullif(p_data ->> 'amount_total', '')::integer;
    if v_amount is not null and v_amount <> v_order.total_cents then
      update public.stripe_events
      set status = 'failed', result = jsonb_build_object('reason', 'amount_mismatch'), processed_at = now()
      where stripe_event_id = p_event_id;
      return jsonb_build_object('status', 'failed', 'reason', 'amount_mismatch');
    end if;

    update public.orders
    set payment_status = 'paid', order_status = 'confirmed', paid_at = coalesce(paid_at, now()),
        stripe_checkout_session_id = coalesce(nullif(p_data ->> 'session_id', ''), stripe_checkout_session_id),
        stripe_payment_intent_id = coalesce(nullif(p_data ->> 'payment_intent_id', ''), stripe_payment_intent_id),
        stripe_customer_id = coalesce(nullif(p_data ->> 'customer_id', ''), stripe_customer_id)
    where id = v_order.id and payment_status <> 'paid';

    update public.paintings
    set status = 'sold', reserved_order_id = null, reserved_until = null
    where reserved_order_id = v_order.id and status = 'reserved';

    insert into public.order_events (
      order_id, event_type, stripe_event_id, actor_type, customer_safe_description
    ) values (
      v_order.id, 'payment_confirmed', p_event_id, 'stripe', 'Payment confirmed.'
    ) on conflict (stripe_event_id) do nothing;

    insert into public.email_outbox (order_id, template, recipient, dedupe_key, payload)
    values
      (v_order.id, 'order_confirmation', v_order.customer_email, 'order_confirmation:' || v_order.id::text, jsonb_build_object('order_id', v_order.id)),
      (v_order.id, 'admin_new_order', 'ADMIN_EMAIL', 'admin_new_order:' || v_order.id::text, jsonb_build_object('order_id', v_order.id))
    on conflict (dedupe_key) do nothing;

    update public.stripe_events set status = 'processed', result = jsonb_build_object('order_id', v_order.id), processed_at = now()
    where stripe_event_id = p_event_id;
    return jsonb_build_object('status', 'processed', 'order_id', v_order.id);

  elsif p_event_type in ('checkout.session.expired', 'checkout.session.async_payment_failed', 'payment_intent.payment_failed', 'payment_intent.canceled') then
    if found and v_order.payment_status <> 'paid' then
      perform private.release_checkout_reservation(v_order.id, p_event_type);
      update public.orders
      set payment_status = case when p_event_type = 'payment_intent.payment_failed' then 'failed' else 'cancelled' end
      where id = v_order.id and payment_status <> 'paid';
      insert into public.order_events (order_id, event_type, stripe_event_id, actor_type, customer_safe_description)
      values (v_order.id, 'payment_not_completed', p_event_id, 'stripe', 'Payment was not completed.')
      on conflict (stripe_event_id) do nothing;
    end if;
    update public.stripe_events set status = 'processed', result = jsonb_build_object('released', found), processed_at = now()
    where stripe_event_id = p_event_id;
    return jsonb_build_object('status', 'processed');

  elsif p_event_type in ('refund.created', 'refund.updated', 'charge.refunded') then
    if not found then
      update public.stripe_events set status = 'failed', result = jsonb_build_object('reason', 'order_not_found'), processed_at = now()
      where stripe_event_id = p_event_id;
      return jsonb_build_object('status', 'failed', 'reason', 'order_not_found');
    end if;
    v_refund_id := nullif(p_data ->> 'refund_id', '');
    v_amount := greatest(0, coalesce(nullif(p_data ->> 'amount_refunded', '')::integer, 0));
    v_refund_status := coalesce(nullif(p_data ->> 'refund_status', ''), 'pending');

    if v_refund_id is not null then
      insert into public.refunds (order_id, stripe_refund_id, amount_cents, status, reason)
      values (
        v_order.id, v_refund_id, greatest(v_amount, 1),
        case when v_refund_status in ('pending', 'requires_action', 'succeeded', 'failed', 'cancelled') then v_refund_status else 'pending' end,
        coalesce(nullif(p_data ->> 'reason', ''), 'requested_by_customer')
      )
      on conflict (stripe_refund_id) do update
      set status = excluded.status,
          failure_reason = nullif(p_data ->> 'failure_reason', ''),
          amount_cents = excluded.amount_cents;
    end if;

    update public.orders
    set amount_refunded_cents = least(total_cents, greatest(amount_refunded_cents, v_amount)),
        refund_status = case
          when v_refund_status = 'failed' then 'failed'
          when v_amount >= total_cents then 'full'
          when v_amount > 0 then 'partial'
          else 'pending'
        end,
        payment_status = case
          when v_refund_status = 'succeeded' and v_amount >= total_cents then 'refunded'
          when v_refund_status = 'succeeded' and v_amount > 0 then 'partially_refunded'
          else payment_status
        end,
        order_status = case when v_refund_status = 'succeeded' and v_amount >= total_cents then 'refunded' else order_status end
    where id = v_order.id;

    insert into public.order_events (order_id, event_type, stripe_event_id, actor_type, customer_safe_description)
    values (
      v_order.id,
      case when v_refund_status = 'succeeded' then 'refund_completed' else 'refund_updated' end,
      p_event_id, 'stripe',
      case when v_refund_status = 'succeeded' then 'Refund completed.' else 'Refund status updated.' end
    ) on conflict (stripe_event_id) do nothing;

    update public.stripe_events set status = 'processed', result = jsonb_build_object('order_id', v_order.id), processed_at = now()
    where stripe_event_id = p_event_id;
    return jsonb_build_object('status', 'processed', 'order_id', v_order.id);
  else
    update public.stripe_events set status = 'ignored', result = jsonb_build_object('reason', 'event_not_required'), processed_at = now()
    where stripe_event_id = p_event_id;
    return jsonb_build_object('status', 'ignored');
  end if;
exception when others then
  update public.stripe_events
  set status = 'failed', result = jsonb_build_object('reason', left(sqlerrm, 200)), processed_at = now()
  where stripe_event_id = p_event_id;
  return jsonb_build_object('status', 'failed', 'reason', 'processing_error');
end;
$$;

create or replace function public.process_stripe_event(
  p_event_id text,
  p_event_type text,
  p_data jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.process_stripe_event(p_event_id, p_event_type, p_data);
$$;

create or replace function private.lookup_guest_order(p_token text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id
  from public.orders
  where guest_access_token_hash = extensions.digest(convert_to(p_token, 'UTF8'), 'sha256')
    and guest_access_expires_at > now()
  limit 1;
$$;

create or replace function public.lookup_guest_order(p_token text)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.lookup_guest_order(p_token);
$$;

revoke all on all functions in schema private from public;
revoke all on function public.create_checkout_reservation(uuid, uuid, text, text, text, text, jsonb, text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.attach_stripe_checkout_session(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.release_checkout_reservation(uuid, text) from public, anon, authenticated;
revoke all on function public.process_stripe_event(text, text, jsonb) from public, anon, authenticated;
revoke all on function public.lookup_guest_order(text) from public, anon, authenticated;

grant usage on schema private to authenticated, service_role;
grant execute on function private.is_admin() to authenticated, service_role;
grant execute on function private.is_admin_aal2() to authenticated, service_role;
grant execute on function private.update_my_profile(text, text, text) to authenticated;
grant execute on function private.claim_my_guest_orders() to authenticated;
grant execute on function private.create_checkout_reservation(uuid, uuid, text, text, text, text, jsonb, text, text, integer, integer) to service_role;
grant execute on function private.attach_stripe_checkout_session(uuid, text, text, text) to service_role;
grant execute on function private.release_checkout_reservation(uuid, text) to service_role;
grant execute on function private.process_stripe_event(text, text, jsonb) to service_role;
grant execute on function private.lookup_guest_order(text) to service_role;

grant execute on function public.admin_access_state() to authenticated;
grant execute on function public.update_my_profile(text, text, text) to authenticated;
grant execute on function public.claim_my_guest_orders() to authenticated;
grant execute on function public.create_checkout_reservation(uuid, uuid, text, text, text, text, jsonb, text, text, integer, integer) to service_role;
grant execute on function public.attach_stripe_checkout_session(uuid, text, text, text) to service_role;
grant execute on function public.release_checkout_reservation(uuid, text) to service_role;
grant execute on function public.process_stripe_event(text, text, jsonb) to service_role;
grant execute on function public.lookup_guest_order(text) to service_role;

alter table public.profiles enable row level security;
alter table public.paintings enable row level security;
alter table public.painting_media enable row level security;
alter table public.contact_enquiries enable row level security;
alter table public.commission_enquiries enable row level security;
alter table public.commission_inspiration_files enable row level security;
alter table public.customer_addresses enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_events enable row level security;
alter table public.stripe_events enable row level security;
alter table public.refunds enable row level security;
alter table public.payment_methods enable row level security;
alter table public.return_requests enable row level security;
alter table public.return_evidence enable row level security;
alter table public.invoices enable row level security;
alter table public.email_outbox enable row level security;
alter table public.admin_audit_log enable row level security;
alter table public.rate_limit_events enable row level security;

create policy profiles_owner_select on public.profiles
for select to authenticated
using ((select auth.uid()) = id);
create policy profiles_admin_aal2_select on public.profiles
for select to authenticated
using ((select private.is_admin_aal2()));

create policy paintings_public_catalog on public.paintings
for select to anon, authenticated
using (published_at is not null and status in ('available', 'reserved', 'sold'));
create policy paintings_admin_aal2_select on public.paintings
for select to authenticated
using ((select private.is_admin_aal2()));

create policy painting_media_public_catalog on public.painting_media
for select to anon, authenticated
using (
  variant <> 'original'
  and exists (
    select 1 from public.paintings p
    where p.id = painting_id
      and p.published_at is not null
      and p.status in ('available', 'reserved', 'sold')
  )
);
create policy painting_media_admin_aal2_select on public.painting_media
for select to authenticated
using ((select private.is_admin_aal2()));

create policy customer_addresses_owner_select on public.customer_addresses
for select to authenticated
using ((select auth.uid()) = user_id);
create policy customer_addresses_owner_insert on public.customer_addresses
for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy customer_addresses_owner_update on public.customer_addresses
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy customer_addresses_owner_delete on public.customer_addresses
for delete to authenticated
using ((select auth.uid()) = user_id);
create policy customer_addresses_admin_aal2_all on public.customer_addresses
for all to authenticated
using ((select private.is_admin_aal2()))
with check ((select private.is_admin_aal2()));

create policy orders_owner_select on public.orders
for select to authenticated
using ((select auth.uid()) = customer_user_id);
create policy orders_admin_aal2_select on public.orders
for select to authenticated
using ((select private.is_admin_aal2()));

create policy order_items_owner_select on public.order_items
for select to authenticated
using (
  exists (
    select 1 from public.orders o
    where o.id = order_id and o.customer_user_id = (select auth.uid())
  )
);
create policy order_items_admin_aal2_select on public.order_items
for select to authenticated
using ((select private.is_admin_aal2()));

create policy order_events_owner_select on public.order_events
for select to authenticated
using (
  exists (
    select 1 from public.orders o
    where o.id = order_id and o.customer_user_id = (select auth.uid())
  )
);
create policy order_events_admin_aal2_select on public.order_events
for select to authenticated
using ((select private.is_admin_aal2()));

create policy refunds_owner_select on public.refunds
for select to authenticated
using (
  exists (
    select 1 from public.orders o
    where o.id = order_id and o.customer_user_id = (select auth.uid())
  )
);
create policy refunds_admin_aal2_select on public.refunds
for select to authenticated
using ((select private.is_admin_aal2()));

create policy payment_methods_owner_select on public.payment_methods
for select to authenticated
using ((select auth.uid()) = user_id);
create policy payment_methods_admin_aal2_select on public.payment_methods
for select to authenticated
using ((select private.is_admin_aal2()));

create policy return_requests_owner_select on public.return_requests
for select to authenticated
using ((select auth.uid()) = user_id);
create policy return_requests_admin_aal2_select on public.return_requests
for select to authenticated
using ((select private.is_admin_aal2()));

create policy return_evidence_owner_select on public.return_evidence
for select to authenticated
using ((select auth.uid()) = user_id);
create policy return_evidence_admin_aal2_select on public.return_evidence
for select to authenticated
using ((select private.is_admin_aal2()));

create policy invoices_owner_select on public.invoices
for select to authenticated
using (
  exists (
    select 1 from public.orders o
    where o.id = order_id and o.customer_user_id = (select auth.uid())
  )
);
create policy invoices_admin_aal2_select on public.invoices
for select to authenticated
using ((select private.is_admin_aal2()));

create policy email_outbox_admin_aal2_select on public.email_outbox
for select to authenticated
using ((select private.is_admin_aal2()));
create policy admin_audit_log_admin_aal2_select on public.admin_audit_log
for select to authenticated
using ((select private.is_admin_aal2()));
create policy contact_enquiries_admin_aal2_select on public.contact_enquiries
for select to authenticated
using ((select private.is_admin_aal2()));
create policy commission_enquiries_admin_aal2_select on public.commission_enquiries
for select to authenticated
using ((select private.is_admin_aal2()));
create policy commission_inspiration_admin_aal2_select on public.commission_inspiration_files
for select to authenticated
using ((select private.is_admin_aal2()));

revoke all on all tables in schema public from anon, authenticated;

grant select (
  id, slug, title, description, story, price_cents, currency,
  width_cm, height_cm, depth_cm, medium, surface, category, orientation,
  framed, frame_description, signed, ready_to_hang, certificate,
  status, featured, year, seo_title, seo_description, published_at, created_at, updated_at
) on public.paintings to anon, authenticated;
grant select (
  id, painting_id, kind, storage_path, variant, width, height, bytes,
  mime_type, alt_text, position, created_at
) on public.painting_media to anon, authenticated;

grant select (id, first_name, last_name, phone, role, stripe_customer_id, created_at, updated_at)
on public.profiles to authenticated;
grant select, insert, update, delete on public.customer_addresses to authenticated;
grant select (
  id, order_reference, customer_user_id, customer_email, customer_first_name,
  customer_last_name, customer_phone, shipping_address, billing_address,
  delivery_method, shipping_method, delivery_notes, order_type, currency,
  subtotal_cents, shipping_cents, tax_cents, total_cents, payment_status,
  fulfillment_status, order_status, amount_refunded_cents, refund_status,
  tracking_carrier, tracking_number, tracking_url, shipped_at, delivered_at,
  commission_eta, customer_status_message, paid_at, cancelled_at, created_at, updated_at
) on public.orders to authenticated;
grant select on public.order_items to authenticated;
grant select (id, order_id, event_type, actor_type, customer_safe_description, created_at)
on public.order_events to authenticated;
grant select (id, order_id, stripe_refund_id, amount_cents, status, reason, created_at, updated_at)
on public.refunds to authenticated;
grant select (id, user_id, brand, last4, exp_month, exp_year, is_default, created_at, updated_at)
on public.payment_methods to authenticated;
grant select (
  id, order_id, user_id, reason, explanation, status, admin_response,
  requested_refund_cents, approved_refund_cents, created_at, updated_at
) on public.return_requests to authenticated;
grant select (id, return_request_id, user_id, storage_path, mime_type, bytes, created_at)
on public.return_evidence to authenticated;
grant select (id, order_id, invoice_reference, version, issued_at, created_at)
on public.invoices to authenticated;
grant select on public.contact_enquiries, public.commission_enquiries,
  public.commission_inspiration_files, public.email_outbox, public.admin_audit_log
to authenticated;

grant all privileges on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('artwork-public', 'artwork-public', true, 10485760, array['image/avif', 'image/jpeg', 'image/png', 'image/webp']),
  ('artwork-originals', 'artwork-originals', false, 31457280, array['image/jpeg', 'image/png', 'image/webp']),
  ('commission-inspiration', 'commission-inspiration', false, 8388608, array['image/jpeg', 'image/png', 'image/webp']),
  ('return-evidence', 'return-evidence', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('invoices', 'invoices', false, 2097152, array['application/pdf'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy artwork_public_read on storage.objects
for select to anon, authenticated
using (bucket_id = 'artwork-public');
create policy artwork_public_admin_insert on storage.objects
for insert to authenticated
with check (bucket_id = 'artwork-public' and (select private.is_admin_aal2()));
create policy artwork_public_admin_update on storage.objects
for update to authenticated
using (bucket_id = 'artwork-public' and (select private.is_admin_aal2()))
with check (bucket_id = 'artwork-public' and (select private.is_admin_aal2()));
create policy artwork_public_admin_delete on storage.objects
for delete to authenticated
using (bucket_id = 'artwork-public' and (select private.is_admin_aal2()));

create policy artwork_originals_admin_select on storage.objects
for select to authenticated
using (bucket_id = 'artwork-originals' and (select private.is_admin_aal2()));
create policy artwork_originals_admin_insert on storage.objects
for insert to authenticated
with check (bucket_id = 'artwork-originals' and (select private.is_admin_aal2()));
create policy artwork_originals_admin_update on storage.objects
for update to authenticated
using (bucket_id = 'artwork-originals' and (select private.is_admin_aal2()))
with check (bucket_id = 'artwork-originals' and (select private.is_admin_aal2()));
create policy artwork_originals_admin_delete on storage.objects
for delete to authenticated
using (bucket_id = 'artwork-originals' and (select private.is_admin_aal2()));

create policy return_evidence_owner_select on storage.objects
for select to authenticated
using (
  bucket_id = 'return-evidence'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.return_requests r
    where r.id::text = (storage.foldername(name))[2]
      and r.user_id = (select auth.uid())
  )
);
create policy return_evidence_owner_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'return-evidence'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.return_requests r
    where r.id::text = (storage.foldername(name))[2]
      and r.user_id = (select auth.uid())
  )
);
create policy return_evidence_admin_select on storage.objects
for select to authenticated
using (bucket_id = 'return-evidence' and (select private.is_admin_aal2()));

create policy invoice_owner_select on storage.objects
for select to authenticated
using (bucket_id = 'invoices' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy invoice_admin_select on storage.objects
for select to authenticated
using (bucket_id = 'invoices' and (select private.is_admin_aal2()));

create policy commission_inspiration_admin_select on storage.objects
for select to authenticated
using (bucket_id = 'commission-inspiration' and (select private.is_admin_aal2()));

-- Storage writes by guest enquiry forms and invoice generation use server-created
-- signed upload URLs or the service role. No anonymous bucket write policy exists.
