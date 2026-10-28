-- Read-only companion to readiness-snapshot.sql. Export privately.
select jsonb_build_object(
  'project_ref', 'fhxgcvdwvagqnxgydyca',
  'schema_grants', (select jsonb_agg(jsonb_build_object('schema',n.nspname,
    'grantee',case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,
    'privilege',a.privilege_type,'grantable',a.is_grantable))
    from pg_namespace n cross join lateral aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a
    where n.nspname in ('public','private','auth','storage')),
  'table_grants', (select jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,
    'grantee',case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,
    'privilege',a.privilege_type,'grantable',a.is_grantable))
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
    where n.nspname in ('public','private','auth','storage') and c.relkind in ('r','p')),
  'function_grants', (select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,
    'arguments',pg_get_function_identity_arguments(p.oid),
    'grantee',case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,
    'privilege',a.privilege_type,'grantable',a.is_grantable))
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
    where n.nspname in ('public','private') and p.prokind in ('f','p')),
  'default_privileges', (select jsonb_agg(to_jsonb(d)) from pg_default_acl d),
  'managed_enums', (select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',t.typname,
    'labels',(select jsonb_agg(enumlabel order by enumsortorder) from pg_enum e where e.enumtypid=t.oid)))
    from pg_type t join pg_namespace n on n.oid=t.typnamespace
    where t.typtype='e' and n.nspname in ('auth','storage'))
) as security_snapshot;
