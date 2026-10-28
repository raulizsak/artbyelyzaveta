-- Leases and explicit delivery outcomes prevent automatic retries after an
-- ambiguous SMTP acceptance. No existing notification is marked delivered.
alter table public.email_outbox
  drop constraint email_outbox_status_check,
  add constraint email_outbox_status_check check (status in
    ('pending','sending','sent','failed','cancelled','needs_review','dead')),
  add column lease_token uuid,
  add column locked_at timestamptz,
  add column delivery_started_at timestamptz,
  add column smtp_message_id text,
  add column source_type text not null default 'order'
    check (source_type in ('order','contact','commission','operational')),
  add column source_id uuid;

create table public.email_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  outbox_id uuid not null references public.email_outbox(id) on delete cascade,
  lease_token uuid not null unique,
  outcome text not null check (outcome in ('leased','sending','accepted','retry','permanent','ambiguous','abandoned')),
  diagnostic text,
  provider_message_id text,
  smtp_message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.email_delivery_attempts enable row level security;
revoke all on public.email_delivery_attempts from anon, authenticated;
grant select on public.email_delivery_attempts to authenticated;
grant all on public.email_delivery_attempts to service_role;
create policy "AAL2 admins inspect notification attempts" on public.email_delivery_attempts
  for select to authenticated using ((select private.is_admin_aal2()));

create table public.email_worker_health (
  id boolean primary key default true check (id),
  started_at timestamptz,
  completed_at timestamptz,
  last_error text,
  summary jsonb not null default '{}'::jsonb
);
alter table public.email_worker_health enable row level security;
revoke all on public.email_worker_health from anon, authenticated;
grant select on public.email_worker_health to authenticated;
grant all on public.email_worker_health to service_role;
create policy "AAL2 admins inspect notification worker" on public.email_worker_health
  for select to authenticated using ((select private.is_admin_aal2()));
insert into public.email_worker_health(id) values(true);

-- Historical jobs are not a new delivery instruction. Reconcile them against
-- provider records before allowing a new worker to resend an old notification.
update public.email_outbox set status='needs_review',
  last_error='Legacy unsent delivery requires provider reconciliation'
where status in ('pending','failed','sending');

create or replace function private.claim_email_outbox(p_order_id uuid default null, p_limit integer default 10)
returns setof public.email_outbox language plpgsql security definer set search_path='' as $$
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'Service role required' using errcode='42501';
  end if;
  -- A lease lost before sending is safe to reclaim. Once sending starts, only
  -- provider reconciliation can decide whether another attempt is appropriate.
  update public.email_delivery_attempts a set outcome=case
    when e.delivery_started_at is null then 'abandoned' else 'ambiguous' end,
    diagnostic='Worker lease expired', updated_at=now()
  from public.email_outbox e where e.id=a.outbox_id and a.lease_token=e.lease_token
    and e.status='sending' and e.locked_at < now()-interval '5 minutes';
  update public.email_outbox set
    status=case when delivery_started_at is null and attempts<5 then 'failed' else 'needs_review' end,
    last_error=case when delivery_started_at is null then 'Worker stopped before delivery'
      else 'Delivery outcome unknown; reconcile provider records before retry' end,
    lease_token=null, locked_at=null, next_attempt_at=now(), updated_at=now()
  where status='sending' and locked_at < now()-interval '5 minutes';
  return query with candidates as (
    select id from public.email_outbox
    where status in ('pending','failed') and next_attempt_at<=now() and attempts<5
      and (p_order_id is null or order_id=p_order_id)
    order by created_at limit greatest(1,least(p_limit,10)) for update skip locked
  ), claimed as (
    update public.email_outbox e set status='sending', attempts=e.attempts+1,
      lease_token=gen_random_uuid(),locked_at=now(),delivery_started_at=null,updated_at=now()
    from candidates c where e.id=c.id returning e.*
  ), attempts as (
    insert into public.email_delivery_attempts(outbox_id,lease_token,outcome)
    select id,lease_token,'leased' from claimed returning outbox_id
  ) select c.* from claimed c join attempts a on a.outbox_id=c.id;
end; $$;

create function private.start_email_delivery(p_id uuid,p_lease uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'Service role required' using errcode='42501';
  end if;
  update public.email_outbox set delivery_started_at=now(),updated_at=now()
    where id=p_id and lease_token=p_lease and status='sending' and delivery_started_at is null;
  if not found then return false; end if;
  update public.email_delivery_attempts set outcome='sending',updated_at=now() where lease_token=p_lease;
  return true;
end; $$;
create function public.start_email_delivery(p_id uuid,p_lease uuid)
returns boolean language sql set search_path='' as $$ select private.start_email_delivery(p_id,p_lease); $$;

create function private.finish_email_delivery(p_id uuid,p_lease uuid,p_outcome text,
  p_diagnostic text default null,p_provider_id text default null,p_message_id text default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare job public.email_outbox%rowtype; v_status text;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'Service role required' using errcode='42501';
  end if;
  if p_outcome is null or p_outcome not in ('accepted','retry','permanent','ambiguous') then
    raise exception 'Invalid delivery outcome';
  end if;
  select * into job from public.email_outbox where id=p_id and lease_token=p_lease
    and status='sending' for update;
  if not found then return false; end if;
  v_status := case when p_outcome='accepted' then 'sent'
    when p_outcome='ambiguous' then 'needs_review'
    when p_outcome='permanent' or job.attempts>=5 then 'dead' else 'failed' end;
  update public.email_outbox set status=v_status,
    provider_message_id=coalesce(p_provider_id,provider_message_id),
    smtp_message_id=coalesce(p_message_id,smtp_message_id),
    sent_at=case when p_outcome='accepted' then now() else sent_at end,
    last_error=case when p_outcome='accepted' then null else left(p_diagnostic,500) end,
    next_attempt_at=now()+make_interval(secs=>least(21600,(60*power(2,greatest(job.attempts-1,0)))::integer)),
    lease_token=null,locked_at=null,updated_at=now() where id=job.id;
  update public.email_delivery_attempts set outcome=p_outcome,
    diagnostic=left(p_diagnostic,500),provider_message_id=p_provider_id,
    smtp_message_id=p_message_id,updated_at=now() where lease_token=p_lease;
  if job.source_type='contact' then
    update public.contact_enquiries set notification_status=case when v_status='sent' then 'sent' else 'failed' end,
      notification_sent_at=case when v_status='sent' then now() else notification_sent_at end,
      notification_provider_id=p_provider_id,notification_error=case when v_status='sent' then null else left(p_diagnostic,500) end
      where id=job.source_id;
  elsif job.source_type='commission' then
    update public.commission_enquiries set notification_status=case when v_status='sent' then 'sent' else 'failed' end,
      notification_sent_at=case when v_status='sent' then now() else notification_sent_at end,
      notification_provider_id=p_provider_id,notification_error=case when v_status='sent' then null else left(p_diagnostic,500) end
      where id=job.source_id;
  elsif job.template='delivered' and v_status='sent' then
    update public.orders set delivered_email_sent_at=coalesce(delivered_email_sent_at,now()) where id=job.order_id;
  end if;
  return true;
end; $$;
create function public.finish_email_delivery(p_id uuid,p_lease uuid,p_outcome text,
  p_diagnostic text default null,p_provider_id text default null,p_message_id text default null)
returns boolean language sql set search_path='' as $$
  select private.finish_email_delivery(p_id,p_lease,p_outcome,p_diagnostic,p_provider_id,p_message_id); $$;

create function private.enqueue_enquiry_email() returns trigger language plpgsql security definer set search_path='' as $$
declare kind text := case when tg_table_name='contact_enquiries' then 'contact' else 'commission' end;
begin
  insert into public.email_outbox(template,recipient,source_type,source_id,dedupe_key,next_attempt_at)
  values(kind||'_enquiry','STORE_NOTIFICATION_EMAIL',kind,new.id,
    kind||':'||new.id::text||':owner',now()+interval '30 seconds') on conflict(dedupe_key) do nothing;
  return new;
end; $$;
create trigger queue_contact_notification after insert on public.contact_enquiries
  for each row execute function private.enqueue_enquiry_email();
create trigger queue_commission_notification after insert on public.commission_enquiries
  for each row execute function private.enqueue_enquiry_email();

-- Existing failures become visible for reconciliation, without silently resending
-- potentially delivered historical enquiries during deployment.
insert into public.email_outbox(template,recipient,source_type,source_id,dedupe_key,status,last_error)
select 'contact_enquiry','STORE_NOTIFICATION_EMAIL','contact',id,'contact:'||id::text||':owner',
  'needs_review','Historical enquiry notification requires provider reconciliation'
from public.contact_enquiries where notification_status<>'sent' on conflict(dedupe_key) do nothing;
insert into public.email_outbox(template,recipient,source_type,source_id,dedupe_key,status,last_error)
select 'commission_enquiry','STORE_NOTIFICATION_EMAIL','commission',id,'commission:'||id::text||':owner',
  'needs_review','Historical enquiry notification requires provider reconciliation'
from public.commission_enquiries where notification_status<>'sent' on conflict(dedupe_key) do nothing;

create function private.resolve_email_delivery(p_id uuid,p_resolution text,p_note text,p_provider_id text default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare job public.email_outbox%rowtype;
begin
  if not private.is_admin_aal2() then raise exception 'Admin MFA required' using errcode='42501'; end if;
  if coalesce(length(trim(p_note)),0)<10 or p_resolution is null or p_resolution not in ('retry','sent','cancelled') then raise exception 'Reconciliation note required'; end if;
  if p_resolution='sent' and nullif(trim(p_provider_id),'') is null then raise exception 'Provider evidence required'; end if;
  select * into job from public.email_outbox where id=p_id and status in ('needs_review','dead','failed') for update;
  if not found then return false; end if;
  update public.email_outbox set status=case when p_resolution='retry' then 'pending' else p_resolution end,
    attempts=case when p_resolution='retry' then 0 else attempts end,
    provider_message_id=coalesce(p_provider_id,provider_message_id),
    sent_at=case when p_resolution='sent' then now() else sent_at end,
    next_attempt_at=now(),lease_token=null,locked_at=null,delivery_started_at=null,
    last_error=case when p_resolution='retry' then null else left(p_note,500) end,updated_at=now() where id=p_id;
  insert into public.admin_audit_log(actor_user_id,action,target_type,target_id,safe_metadata)
    values(auth.uid(),'email.reconciled','email_outbox',p_id,jsonb_build_object('resolution',p_resolution,'note',left(p_note,500)));
  return true;
end; $$;
create function public.resolve_email_delivery(p_id uuid,p_resolution text,p_note text,p_provider_id text default null)
returns boolean language sql set search_path='' as $$ select private.resolve_email_delivery(p_id,p_resolution,p_note,p_provider_id); $$;

revoke all on function private.start_email_delivery(uuid,uuid), public.start_email_delivery(uuid,uuid),
  private.finish_email_delivery(uuid,uuid,text,text,text,text),public.finish_email_delivery(uuid,uuid,text,text,text,text)
  from public,anon,authenticated;
grant execute on function private.start_email_delivery(uuid,uuid), public.start_email_delivery(uuid,uuid),
  private.finish_email_delivery(uuid,uuid,text,text,text,text),public.finish_email_delivery(uuid,uuid,text,text,text,text) to service_role;
revoke all on function private.enqueue_enquiry_email() from public,anon,authenticated,service_role;
revoke all on function private.resolve_email_delivery(uuid,text,text,text), public.resolve_email_delivery(uuid,text,text,text)
  from public,anon,authenticated,service_role;
grant execute on function private.resolve_email_delivery(uuid,text,text,text),public.resolve_email_delivery(uuid,text,text,text) to authenticated;

create function private.cancel_removed_enquiry_email() returns trigger language plpgsql security definer set search_path='' as $$
declare kind text := case when tg_table_name='contact_enquiries' then 'contact' else 'commission' end;
begin
  update public.email_outbox set status='cancelled',last_error='Source enquiry was removed before delivery',updated_at=now()
    where source_type=kind and source_id=old.id and status in ('pending','failed','needs_review','dead');
  return old;
end; $$;
revoke all on function private.cancel_removed_enquiry_email() from public,anon,authenticated,service_role;
create trigger cancel_contact_notification after delete on public.contact_enquiries
  for each row execute function private.cancel_removed_enquiry_email();
create trigger cancel_commission_notification after delete on public.commission_enquiries
  for each row execute function private.cancel_removed_enquiry_email();

-- One consolidated operational email per UTC day. Uses the same fenced worker,
-- so provider uncertainty cannot produce an automatic stream of duplicate alerts.
create function private.enqueue_notification_alert() returns void
language plpgsql security definer set search_path='' as $$
declare attention integer; delayed integer;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'Service role required' using errcode='42501';
  end if;
  select count(*) into attention from public.email_outbox
    where source_type<>'operational' and status in ('needs_review','dead');
  select count(*) into delayed from public.email_outbox
    where source_type<>'operational' and status in ('pending','failed')
      and created_at<now()-interval '15 minutes';
  if attention+delayed>0 then
    insert into public.email_outbox(template,recipient,source_type,dedupe_key,payload)
    values('notification_alert','STORE_NOTIFICATION_EMAIL','operational',
      'notification-alert:'||to_char(now() at time zone 'UTC','YYYY-MM-DD'),
      jsonb_build_object('attention',attention,'delayed',delayed))
    on conflict(dedupe_key) do nothing;
  end if;
end; $$;
create function public.enqueue_notification_alert() returns void language sql set search_path='' as $$
  select private.enqueue_notification_alert(); $$;
revoke all on function private.enqueue_notification_alert(), public.enqueue_notification_alert()
  from public,anon,authenticated;
grant execute on function private.enqueue_notification_alert(), public.enqueue_notification_alert() to service_role;
notify pgrst, 'reload schema';
