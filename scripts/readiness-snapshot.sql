-- Read-only logical recovery export. Run in the verified project SQL editor,
-- then export the result privately. Includes private business/Auth records.
-- Never commit the exported result or run it against an unrelated project.
set timezone = 'UTC';
select jsonb_build_object(
  'project_ref', 'fhxgcvdwvagqnxgydyca',
  'captured_at', transaction_timestamp(),
  'server_version', current_setting('server_version'),
  'tables', (
    select jsonb_agg(jsonb_build_object(
      'schema', n.nspname, 'name', c.relname,
      'owner', pg_get_userbyid(c.relowner), 'acl', c.relacl::text,
      'rls', c.relrowsecurity, 'force_rls', c.relforcerowsecurity,
      'columns', (select jsonb_agg(jsonb_build_object(
        'name', a.attname, 'type', format_type(a.atttypid, a.atttypmod),
        'not_null', a.attnotnull, 'identity', a.attidentity,
        'generated', a.attgenerated,
        'default', pg_get_expr(d.adbin, d.adrelid)
      ) order by a.attnum) from pg_attribute a
        left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
        where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),
      'constraints', (select jsonb_agg(jsonb_build_object('name', x.conname,
        'definition', pg_get_constraintdef(x.oid, true)) order by x.conname)
        from pg_constraint x where x.conrelid=c.oid),
      'indexes', (select jsonb_agg(indexdef order by indexname) from pg_indexes
        where schemaname=n.nspname and tablename=c.relname),
      'records_xml', query_to_xml(format(
        'select count(*) as row_count, md5(coalesce(jsonb_agg(to_jsonb(t) order by md5(to_jsonb(t)::text)), ''[]''::jsonb)::text) as checksum, coalesce(jsonb_agg(to_jsonb(t) order by md5(to_jsonb(t)::text)), ''[]''::jsonb)::text as records from %I.%I t',
        n.nspname,c.relname), false, true, '')::text
    ) order by n.nspname,c.relname)
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname in ('public','private','auth','storage','supabase_migrations','cron')
      and c.relkind in ('r','p') and not c.relispartition
  ),
  'functions', (
    select jsonb_agg(jsonb_build_object(
      'schema', n.nspname, 'name', p.proname,
      'identity', p.oid::regprocedure::text,
      'arguments', pg_get_function_identity_arguments(p.oid),
      'ddl', pg_get_functiondef(p.oid), 'acl', p.proacl::text,
      'owner', pg_get_userbyid(p.proowner)
    ) order by n.nspname,p.proname,p.oid)
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','private') and p.prokind in ('f','p')
  ),
  'policies', (select jsonb_agg(to_jsonb(p) order by schemaname,tablename,policyname)
    from pg_policies p where schemaname in ('public','private','storage')),
  'triggers', (select jsonb_agg(jsonb_build_object(
    'schema', n.nspname, 'table', c.relname, 'name', t.tgname,
    'ddl', pg_get_triggerdef(t.oid, true), 'enabled', t.tgenabled
  ) order by n.nspname,c.relname,t.tgname)
    from pg_trigger t join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace
    where not t.tgisinternal and n.nspname in ('public','private','auth','storage')),
  'enums', (select jsonb_agg(jsonb_build_object('schema',n.nspname,
    'name',t.typname,'labels',(select jsonb_agg(enumlabel order by enumsortorder)
      from pg_enum e where e.enumtypid=t.oid)))
    from pg_type t join pg_namespace n on n.oid=t.typnamespace
    where t.typtype='e' and n.nspname in ('public','private')),
  'extensions', (select jsonb_agg(jsonb_build_object('name', extname,'version', extversion)) from pg_extension),
  'sequences', (select jsonb_agg(to_jsonb(s)) from pg_sequences s
    where schemaname in ('public','private','auth','storage'))
) as recovery_snapshot;
