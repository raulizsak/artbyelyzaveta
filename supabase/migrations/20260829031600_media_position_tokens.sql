-- Make painting media ordering independent of historical storage-path layouts.
-- Each image's generated variants already share one integer position, so the
-- editor passes opaque `position:N` tokens and the database updates every
-- variant in that image group atomically.
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

  select count(distinct position)::integer
  into v_existing
  from public.painting_media
  where painting_id = p_painting_id;

  select count(distinct key)::integer
  into v_requested
  from unnest(p_group_keys) as requested(key);

  if v_existing <> v_requested
     or v_requested <> coalesce(array_length(p_group_keys, 1), 0)
     or exists (
       select 1
       from unnest(p_group_keys) as requested(key)
       where requested.key !~ '^position:[0-9]+$'
          or not exists (
            select 1
            from public.painting_media pm
            where pm.painting_id = p_painting_id
              and pm.position = substring(requested.key from 10)::integer
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
    and pm.position = substring(ordered.group_key from 10)::integer + 100000;
end;
$$;

revoke all on function public.admin_reorder_painting_media(uuid, text[])
  from public, anon;
grant execute on function public.admin_reorder_painting_media(uuid, text[])
  to authenticated;
