alter table public.refunds
  add column restock_on_success boolean not null default false;

alter table public.orders
  add column commission_stage text,
  add column expected_dispatch date,
  add constraint orders_commission_stage_check check (
    commission_stage is null or commission_stage in (
      'enquiry', 'accepted', 'deposit_paid', 'in_progress', 'review', 'complete', 'dispatched'
    )
  ),
  add constraint orders_commission_fields_check check (
    order_type = 'commission' or (commission_stage is null and expected_dispatch is null)
  );

create or replace function private.admin_update_commission(
  p_order_id uuid,
  p_stage text,
  p_eta date,
  p_expected_dispatch date,
  p_customer_message text,
  p_internal_notes text,
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
begin
  if not private.is_admin_aal2() then
    raise exception 'AAL2 administrator access required' using errcode = '42501';
  end if;
  if p_stage not in ('enquiry', 'accepted', 'deposit_paid', 'in_progress', 'review', 'complete', 'dispatched') then
    raise exception 'Invalid commission stage' using errcode = '22023';
  end if;

  update public.orders
  set commission_stage = p_stage,
      commission_eta = p_eta,
      expected_dispatch = p_expected_dispatch,
      customer_status_message = nullif(btrim(p_customer_message), ''),
      internal_admin_notes = nullif(btrim(p_internal_notes), ''),
      updated_at = now()
  where id = p_order_id and order_type = 'commission'
  returning * into v_order;
  if not found then
    raise exception 'Commission order not found' using errcode = 'P0002';
  end if;

  insert into public.order_events (
    id, order_id, event_type, actor_user_id, actor_type,
    customer_safe_description, internal_metadata
  ) values (
    v_event_id, p_order_id, 'commission_update', auth.uid(), 'admin',
    'Commission progress updated.',
    jsonb_build_object('stage', p_stage, 'eta', p_eta, 'expected_dispatch', p_expected_dispatch)
  );
  insert into public.admin_audit_log (
    actor_user_id, action, target_type, target_id, safe_metadata
  ) values (
    auth.uid(), 'order.commission_update', 'order', p_order_id::text,
    jsonb_build_object('stage', p_stage, 'eta', p_eta, 'expected_dispatch', p_expected_dispatch)
  );
  if p_notify then
    insert into public.email_outbox (order_id, template, recipient, payload, dedupe_key)
    values (
      p_order_id, 'commission_update', v_order.customer_email,
      jsonb_build_object('order_id', p_order_id, 'event_id', v_event_id),
      'commission_update:' || v_event_id::text
    );
  end if;
  return v_order;
end;
$$;

create or replace function public.admin_update_commission(
  p_order_id uuid,
  p_stage text,
  p_eta date,
  p_expected_dispatch date,
  p_customer_message text,
  p_internal_notes text,
  p_notify boolean default true
)
returns public.orders
language sql
security invoker
set search_path = ''
as $$
  select private.admin_update_commission(
    p_order_id, p_stage, p_eta, p_expected_dispatch,
    p_customer_message, p_internal_notes, p_notify
  );
$$;

revoke all on function public.admin_update_commission(uuid, text, date, date, text, text, boolean)
  from public, anon;
revoke all on function private.admin_update_commission(uuid, text, date, date, text, text, boolean)
  from public, anon;
grant execute on function private.admin_update_commission(uuid, text, date, date, text, text, boolean)
  to authenticated;
grant execute on function public.admin_update_commission(uuid, text, date, date, text, text, boolean)
  to authenticated;

create or replace function private.restock_cancelled_order_after_refund()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.payment_status <> 'refunded'
     or old.payment_status = 'refunded'
     or not exists (
       select 1 from public.refunds
       where order_id = new.id
         and restock_on_success
         and status = 'succeeded'
     ) then
    return new;
  end if;

  update public.paintings
  set status = 'available', reserved_order_id = null, reserved_until = null
  where status = 'sold'
    and id in (
      select painting_id from public.order_items
      where order_id = new.id and painting_id is not null
    );

  return new;
end;
$$;

drop trigger if exists orders_restock_after_cancelled_refund on public.orders;
create trigger orders_restock_after_cancelled_refund
after update of payment_status on public.orders
for each row
execute function private.restock_cancelled_order_after_refund();

revoke all on function private.restock_cancelled_order_after_refund() from public;
