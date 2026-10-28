-- Preserve one-of-one inventory until a signed terminal Stripe event or a
-- provider-verified admin cancellation closes the session. Local timestamps
-- and retryable card declines do not prove that a customer cannot still pay.
-- Patch the existing functions without changing their grants or signatures.
do $migration$
declare
  definition text;
  original text;
  target regprocedure;
begin
  foreach target in array array[
    'private.create_commerce_checkout(uuid[],uuid,text,text,text,text,jsonb,text,text,text[],integer)'::regprocedure,
    'private.create_checkout_reservation(uuid,uuid,text,text,text,text,jsonb,text,text,integer,integer)'::regprocedure
  ] loop
    original := pg_get_functiondef(target);
    definition := regexp_replace(original,
      '  if v_painting.status = ''reserved'' and v_painting.reserved_until <= now\(\) then.*?  end if;',
      '  -- Reservation release requires authoritative provider closure.', 's');
    -- The multi-painting function uses four-space indentation inside its loop.
    if definition = original then
      raise exception 'Expected reservation expiry block missing in %', target;
    end if;
    execute definition;
  end loop;

  original := pg_get_functiondef('private.process_stripe_event(text,text,jsonb)'::regprocedure);
  definition := replace(original,
    '  if p_event_type in (''checkout.session.completed'', ''checkout.session.async_payment_succeeded'', ''payment_intent.succeeded'') then',
    $guard$
  if p_event_type = 'payment_intent.payment_failed' then
    -- A declined attempt can be retried within the same Checkout Session.
    update public.stripe_events set status = 'processed',
      result = jsonb_build_object('payment', 'retryable_failure'), processed_at = now()
    where stripe_event_id = p_event_id;
    return jsonb_build_object('status', 'processed', 'order_id', v_order.id, 'payment', 'retryable_failure');
  end if;

  if p_event_type in ('checkout.session.completed', 'checkout.session.async_payment_succeeded', 'payment_intent.succeeded') then
    if found and v_order.payment_status in ('paid', 'partially_refunded', 'refunded') then
      update public.stripe_events set status = 'processed', result = '{"payment":"already_finalized"}'::jsonb, processed_at = now()
      where stripe_event_id = p_event_id;
      return jsonb_build_object('status', 'ignored', 'order_id', v_order.id);
    end if;
    if found and (p_event_type <> 'checkout.session.completed' or coalesce(p_data ->> 'payment_status', '') = 'paid')
      and exists (
        select 1 from public.order_items item join public.paintings painting on painting.id = item.painting_id
        where item.order_id = v_order.id
          and (painting.status <> 'reserved' or painting.reserved_order_id is distinct from v_order.id)
      ) then
      update public.stripe_events set status = 'failed', result = '{"reason":"inventory_conflict"}'::jsonb, processed_at = now()
      where stripe_event_id = p_event_id;
      return jsonb_build_object('status', 'failed', 'reason', 'inventory_conflict');
    end if;
$guard$);
  if definition = original then raise exception 'Expected Stripe payment transition block missing'; end if;
  definition := replace(definition,
    'if found and v_order.payment_status <> ''paid'' then',
    'if found and v_order.payment_status not in (''paid'', ''partially_refunded'', ''refunded'') then');
  execute definition;
end;
$migration$;
