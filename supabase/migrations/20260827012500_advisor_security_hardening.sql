-- Public buckets serve object URLs through the Storage API without granting
-- PostgREST enumeration of storage.objects.
drop policy if exists artwork_public_read on storage.objects;

-- New Supabase projects may install this event-trigger helper with default
-- PUBLIC execution. The event trigger still runs as its postgres owner after
-- untrusted API roles lose direct execute privileges.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end;
$$;
