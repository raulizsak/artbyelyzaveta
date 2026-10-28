-- Dormant dispatcher: activation and its secret belong to the deployment's
-- operational configuration, so local resets cannot call the production worker.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create function private.dispatch_email_worker() returns bigint
language plpgsql security definer set search_path='' as $$
declare trigger_secret text; request_id bigint;
begin
  select decrypted_secret into trigger_secret from vault.decrypted_secrets
    where name='art_by_elyzaveta_email_worker';
  if nullif(trigger_secret,'') is null then raise exception 'Email worker secret is not configured'; end if;
  select net.http_post(
    url:='https://artbyelyzaveta.shop/api/internal/email-outbox',
    headers:=jsonb_build_object('Content-Type','application/json','x-email-outbox-secret',trigger_secret),
    body:='{}'::jsonb,
    timeout_milliseconds:=90000
  ) into request_id;
  return request_id;
end; $$;
revoke all on function private.dispatch_email_worker() from public,anon,authenticated,service_role;
