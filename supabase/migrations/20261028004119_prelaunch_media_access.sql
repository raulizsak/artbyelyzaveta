-- Public image URLs remain readable, while storage-table enumeration requires
-- the same owner-approved admin role and MFA used for existing upload writes.
create policy artwork_public_admin_select on storage.objects
for select to authenticated
using (bucket_id = 'artwork-public' and (select private.is_admin_aal2()));
