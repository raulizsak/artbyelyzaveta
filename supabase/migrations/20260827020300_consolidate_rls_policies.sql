-- Consolidate owner/admin policy pairs so PostgreSQL evaluates one permissive
-- policy per authenticated action. Anonymous catalogue policies remain
-- separate and never call private admin helpers.

drop policy if exists profiles_owner_select on public.profiles;
drop policy if exists profiles_admin_aal2_select on public.profiles;
create policy profiles_authorized_select on public.profiles
for select to authenticated
using ((select auth.uid()) = id or (select private.is_admin_aal2()));

drop policy if exists paintings_public_catalog on public.paintings;
drop policy if exists paintings_admin_aal2_select on public.paintings;
create policy paintings_anon_catalog on public.paintings
for select to anon
using (published_at is not null and status in ('available', 'reserved', 'sold'));
create policy paintings_authenticated_catalog_or_admin on public.paintings
for select to authenticated
using (
  (published_at is not null and status in ('available', 'reserved', 'sold'))
  or (select private.is_admin_aal2())
);

drop policy if exists painting_media_public_catalog on public.painting_media;
drop policy if exists painting_media_admin_aal2_select on public.painting_media;
create policy painting_media_anon_catalog on public.painting_media
for select to anon
using (
  variant <> 'original'
  and exists (
    select 1 from public.paintings p
    where p.id = painting_id
      and p.published_at is not null
      and p.status in ('available', 'reserved', 'sold')
  )
);
create policy painting_media_authenticated_catalog_or_admin on public.painting_media
for select to authenticated
using (
  (
    variant <> 'original'
    and exists (
      select 1 from public.paintings p
      where p.id = painting_id
        and p.published_at is not null
        and p.status in ('available', 'reserved', 'sold')
    )
  )
  or (select private.is_admin_aal2())
);

drop policy if exists customer_addresses_owner_select on public.customer_addresses;
drop policy if exists customer_addresses_owner_insert on public.customer_addresses;
drop policy if exists customer_addresses_owner_update on public.customer_addresses;
drop policy if exists customer_addresses_owner_delete on public.customer_addresses;
drop policy if exists customer_addresses_admin_aal2_all on public.customer_addresses;
create policy customer_addresses_authorized_select on public.customer_addresses
for select to authenticated
using ((select auth.uid()) = user_id or (select private.is_admin_aal2()));
create policy customer_addresses_authorized_insert on public.customer_addresses
for insert to authenticated
with check ((select auth.uid()) = user_id or (select private.is_admin_aal2()));
create policy customer_addresses_authorized_update on public.customer_addresses
for update to authenticated
using ((select auth.uid()) = user_id or (select private.is_admin_aal2()))
with check ((select auth.uid()) = user_id or (select private.is_admin_aal2()));
create policy customer_addresses_authorized_delete on public.customer_addresses
for delete to authenticated
using ((select auth.uid()) = user_id or (select private.is_admin_aal2()));

drop policy if exists orders_owner_select on public.orders;
drop policy if exists orders_admin_aal2_select on public.orders;
create policy orders_authorized_select on public.orders
for select to authenticated
using ((select auth.uid()) = customer_user_id or (select private.is_admin_aal2()));

drop policy if exists order_items_owner_select on public.order_items;
drop policy if exists order_items_admin_aal2_select on public.order_items;
create policy order_items_authorized_select on public.order_items
for select to authenticated
using (
  exists (
    select 1 from public.orders o
    where o.id = order_id and o.customer_user_id = (select auth.uid())
  )
  or (select private.is_admin_aal2())
);

drop policy if exists order_events_owner_select on public.order_events;
drop policy if exists order_events_admin_aal2_select on public.order_events;
create policy order_events_authorized_select on public.order_events
for select to authenticated
using (
  exists (
    select 1 from public.orders o
    where o.id = order_id and o.customer_user_id = (select auth.uid())
  )
  or (select private.is_admin_aal2())
);

drop policy if exists refunds_owner_select on public.refunds;
drop policy if exists refunds_admin_aal2_select on public.refunds;
create policy refunds_authorized_select on public.refunds
for select to authenticated
using (
  exists (
    select 1 from public.orders o
    where o.id = order_id and o.customer_user_id = (select auth.uid())
  )
  or (select private.is_admin_aal2())
);

drop policy if exists payment_methods_owner_select on public.payment_methods;
drop policy if exists payment_methods_admin_aal2_select on public.payment_methods;
create policy payment_methods_authorized_select on public.payment_methods
for select to authenticated
using ((select auth.uid()) = user_id or (select private.is_admin_aal2()));

drop policy if exists return_requests_owner_select on public.return_requests;
drop policy if exists return_requests_admin_aal2_select on public.return_requests;
create policy return_requests_authorized_select on public.return_requests
for select to authenticated
using ((select auth.uid()) = user_id or (select private.is_admin_aal2()));

drop policy if exists return_evidence_owner_select on public.return_evidence;
drop policy if exists return_evidence_admin_aal2_select on public.return_evidence;
create policy return_evidence_authorized_select on public.return_evidence
for select to authenticated
using ((select auth.uid()) = user_id or (select private.is_admin_aal2()));

drop policy if exists invoices_owner_select on public.invoices;
drop policy if exists invoices_admin_aal2_select on public.invoices;
create policy invoices_authorized_select on public.invoices
for select to authenticated
using (
  exists (
    select 1 from public.orders o
    where o.id = order_id and o.customer_user_id = (select auth.uid())
  )
  or (select private.is_admin_aal2())
);
