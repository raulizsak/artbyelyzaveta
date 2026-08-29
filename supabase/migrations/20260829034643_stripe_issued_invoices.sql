alter table public.invoices
  add column if not exists stripe_invoice_id text,
  add column if not exists stripe_mode text,
  add column if not exists stripe_status text,
  add column if not exists hosted_invoice_url text,
  add column if not exists invoice_pdf_url text,
  add column if not exists sent_at timestamptz;

create unique index if not exists invoices_stripe_invoice_id_key
  on public.invoices (stripe_invoice_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'invoices_stripe_mode_check'
      and conrelid = 'public.invoices'::regclass
  ) then
    alter table public.invoices
      add constraint invoices_stripe_mode_check
      check (stripe_mode in ('test', 'live'));
  end if;
end
$$;

create index if not exists invoices_stripe_mode_status_idx
  on public.invoices (stripe_mode, stripe_status)
  where stripe_invoice_id is not null;

comment on column public.invoices.storage_path is
  'Legacy application-generated invoice PDF path. New paid orders use Stripe invoice_pdf_url.';
comment on column public.invoices.invoice_pdf_url is
  'Stripe-hosted PDF URL. Access is brokered through the authorised application route.';
