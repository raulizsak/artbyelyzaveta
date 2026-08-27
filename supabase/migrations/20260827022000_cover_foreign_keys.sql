-- Cover every foreign key used for deletes, joins, audit attribution, and
-- ownership checks. These indexes are deliberately retained before traffic so
-- the first production workload is not exposed to avoidable sequential scans.

create index admin_audit_log_actor_user_idx
  on public.admin_audit_log (actor_user_id);

create index commission_inspiration_files_commission_idx
  on public.commission_inspiration_files (commission_enquiry_id);

create index email_outbox_order_idx
  on public.email_outbox (order_id);

create index order_events_actor_user_idx
  on public.order_events (actor_user_id);

create index paintings_reserved_order_idx
  on public.paintings (reserved_order_id);

create index refunds_requested_by_idx
  on public.refunds (requested_by);

create index return_evidence_return_request_idx
  on public.return_evidence (return_request_id);

create index return_evidence_user_idx
  on public.return_evidence (user_id);
