-- Transactional customer address management and expiring guest-order email access.

create or replace function private.save_my_address(
  p_id uuid,
  p_label text,
  p_recipient_name text,
  p_line1 text,
  p_line2 text,
  p_suburb text,
  p_state text,
  p_postcode text,
  p_country text,
  p_is_default boolean
)
returns public.customer_addresses
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_make_default boolean := coalesce(p_is_default, false);
  v_address public.customer_addresses%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_id is null then
    if not exists (
      select 1 from public.customer_addresses where user_id = v_user_id
    ) then
      v_make_default := true;
    end if;
  elsif not exists (
    select 1
    from public.customer_addresses
    where id = p_id and user_id = v_user_id
    for update
  ) then
    raise exception 'Address not found' using errcode = 'P0002';
  end if;

  if v_make_default then
    update public.customer_addresses
    set is_default = false
    where user_id = v_user_id and is_default;
  end if;

  if p_id is null then
    insert into public.customer_addresses (
      user_id, label, recipient_name, line1, line2, suburb, state, postcode, country, is_default
    ) values (
      v_user_id, btrim(p_label), btrim(p_recipient_name), btrim(p_line1),
      nullif(btrim(p_line2), ''), btrim(p_suburb), btrim(p_state), btrim(p_postcode),
      btrim(p_country), v_make_default
    ) returning * into v_address;
  else
    update public.customer_addresses
    set label = btrim(p_label),
        recipient_name = btrim(p_recipient_name),
        line1 = btrim(p_line1),
        line2 = nullif(btrim(p_line2), ''),
        suburb = btrim(p_suburb),
        state = btrim(p_state),
        postcode = btrim(p_postcode),
        country = btrim(p_country),
        is_default = case when v_make_default then true else is_default end
    where id = p_id and user_id = v_user_id
    returning * into v_address;
  end if;

  return v_address;
end;
$$;

create or replace function public.save_my_address(
  p_id uuid,
  p_label text,
  p_recipient_name text,
  p_line1 text,
  p_line2 text,
  p_suburb text,
  p_state text,
  p_postcode text,
  p_country text,
  p_is_default boolean
)
returns public.customer_addresses
language sql
security invoker
set search_path = ''
as $$
  select private.save_my_address(
    p_id, p_label, p_recipient_name, p_line1, p_line2,
    p_suburb, p_state, p_postcode, p_country, p_is_default
  );
$$;

create or replace function private.delete_my_address(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_was_default boolean;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select is_default into v_was_default
  from public.customer_addresses
  where id = p_id and user_id = v_user_id
  for update;

  if not found then
    return false;
  end if;

  delete from public.customer_addresses
  where id = p_id and user_id = v_user_id;

  if v_was_default or not exists (
    select 1 from public.customer_addresses
    where user_id = v_user_id and is_default
  ) then
    update public.customer_addresses
    set is_default = true
    where id = (
      select id from public.customer_addresses
      where user_id = v_user_id
      order by created_at asc, id asc
      limit 1
    );
  end if;

  return true;
end;
$$;

create or replace function public.delete_my_address(p_id uuid)
returns boolean
language sql
security invoker
set search_path = ''
as $$ select private.delete_my_address(p_id); $$;

revoke all on function public.save_my_address(uuid, text, text, text, text, text, text, text, text, boolean)
  from public, anon;
revoke all on function public.delete_my_address(uuid) from public, anon;
revoke all on function private.save_my_address(uuid, text, text, text, text, text, text, text, text, boolean)
  from public, anon;
revoke all on function private.delete_my_address(uuid) from public, anon;
grant execute on function private.save_my_address(uuid, text, text, text, text, text, text, text, text, boolean)
  to authenticated;
grant execute on function private.delete_my_address(uuid) to authenticated;
grant execute on function public.save_my_address(uuid, text, text, text, text, text, text, text, text, boolean)
  to authenticated;
grant execute on function public.delete_my_address(uuid) to authenticated;

create or replace function private.prepare_guest_paid_order_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
begin
  if new.customer_user_id is not null then
    return new;
  end if;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  update public.orders
  set guest_access_token_hash = extensions.digest(convert_to(v_token, 'UTF8'), 'sha256'),
      guest_access_expires_at = now() + interval '30 days'
  where id = new.id;

  insert into public.email_outbox (order_id, template, recipient, payload, dedupe_key)
  values (
    new.id,
    'order_confirmation',
    new.customer_email,
    jsonb_build_object('order_id', new.id, 'guest_token', v_token),
    'order_confirmation:' || new.id::text
  )
  on conflict (dedupe_key) do update
  set payload = case
        when public.email_outbox.status in ('pending', 'failed')
          then excluded.payload
        else public.email_outbox.payload
      end,
      next_attempt_at = case
        when public.email_outbox.status = 'failed' then now()
        else public.email_outbox.next_attempt_at
      end,
      status = case
        when public.email_outbox.status = 'failed' then 'pending'
        else public.email_outbox.status
      end;

  return new;
end;
$$;

drop trigger if exists orders_prepare_guest_paid_access on public.orders;
create trigger orders_prepare_guest_paid_access
after update of payment_status on public.orders
for each row
when (old.payment_status is distinct from new.payment_status and new.payment_status = 'paid')
execute function private.prepare_guest_paid_order_access();

revoke all on function private.prepare_guest_paid_order_access() from public;
