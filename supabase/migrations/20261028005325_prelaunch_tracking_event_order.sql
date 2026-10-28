-- Provider notifications can be duplicated or arrive out of order. Keep the
-- newest tracking event and never regress a completed delivery.
do $migration$
declare
  original text;
  definition text;
begin
  original := replace(pg_get_functiondef('private.record_tracking_result(uuid,text,jsonb,boolean,timestamptz,text,timestamptz,text,uuid)'::regprocedure), E'\r\n', E'\n');
  definition := replace(original, '  v_transitioned boolean := false;', '  v_transitioned boolean := false; v_incoming_time timestamptz; v_current_time timestamptz;');
  definition := replace(definition, E'  update public.orders set\n    tracking_status =', $guard$
  if v_order.fulfillment_status = 'delivered' and not p_delivered then
    return jsonb_build_object('status', 'ignored', 'transitioned_to_delivered', false);
  end if;
  begin
    v_incoming_time := nullif(p_latest_event ->> 'time', '')::timestamptz;
    v_current_time := nullif(v_order.latest_tracking_event ->> 'time', '')::timestamptz;
  exception when invalid_datetime_format or datetime_field_overflow then
    v_incoming_time := null; v_current_time := null;
  end;
  if v_incoming_time is not null and v_current_time is not null and v_incoming_time < v_current_time then
    return jsonb_build_object('status', 'ignored', 'transitioned_to_delivered', false);
  end if;
  update public.orders set
    tracking_status =
$guard$);
  if definition = original or position('v_incoming_time < v_current_time' in definition) = 0 then raise exception 'Expected tracking update block missing'; end if;
  execute definition;
end;
$migration$;
