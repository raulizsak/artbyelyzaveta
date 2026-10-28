import Link from "next/link";
import { requireAdminAal2 } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
import { formatDisplayValue } from "@/lib/presentation";
import { formatMelbourneDateTime } from "@/lib/date-time";
import { NotificationReconciliation } from "@/components/notification-reconciliation";

export default async function NotificationsPage() {
  await requireAdminAal2("/admin/notifications");
  const db = await createClient();
  const [jobs, health, attention, pending] = await Promise.all([
    db
      .from("email_outbox")
      .select(
        "id,source_type,template,status,recipient,attempts,last_error,provider_message_id,smtp_message_id,created_at,next_attempt_at,orders(order_reference)",
      )
      .order("created_at", { ascending: false })
      .limit(50),
    db.from("email_worker_health").select("*").eq("id", true).maybeSingle(),
    db
      .from("email_outbox")
      .select("id", { head: true, count: "exact" })
      .in("status", ["needs_review", "dead"]),
    db
      .from("email_outbox")
      .select("id", { head: true, count: "exact" })
      .in("status", ["pending", "failed"]),
  ]);
  if (jobs.error || health.error || attention.error || pending.error)
    throw new Error("Notification records could not be loaded.");
  const lastRun = health.data?.completed_at;
  // This authenticated Server Component checks freshness once per request.
  const stale =
    // eslint-disable-next-line react-hooks/purity
    !lastRun || Date.now() - new Date(lastRun).getTime() > 15 * 60 * 1000;
  return (
    <section className="account-panel">
      <p className="eyebrow">Delivery operations</p>
      <h1>Notifications</h1>
      <p>
        Automatic retries are reserved for definite failures. An uncertain
        delivery stays here for provider reconciliation.
      </p>
      <div className="review-grid">
        <div>
          <h2>{attention.count ?? 0} need attention</h2>
          <p>{pending.count ?? 0} queued or retrying</p>
        </div>
        <div>
          <h2>Scheduled worker</h2>
          <p>
            {lastRun
              ? formatMelbourneDateTime(lastRun)
              : "No successful run recorded"}
          </p>
          {stale ? (
            <p className="form-error" role="alert">
              The worker has not completed in the last 15 minutes. Check the
              scheduler and Render logs.
            </p>
          ) : (
            <p>Worker heartbeat is current.</p>
          )}
          {health.data?.last_error ? (
            <p className="form-error">{health.data.last_error}</p>
          ) : null}
        </div>
      </div>
      <p>
        Latest 50 records. Message IDs can be checked against SMTP2GO activity
        before resolving a delivery.
      </p>
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            textAlign: "left",
            borderCollapse: "collapse",
          }}
        >
          <thead>
            <tr>
              <th>Notification</th>
              <th>Status</th>
              <th>Delivery evidence</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {jobs.data.map((job) => (
              <tr key={job.id} style={{ borderTop: "1px solid var(--line)" }}>
                <td style={{ padding: "18px 12px", verticalAlign: "top" }}>
                  <strong>{formatDisplayValue(job.template)}</strong>
                  <p>{job.recipient}</p>
                  {job.orders?.order_reference ? (
                    <Link href={"/admin/orders/" + job.orders.order_reference}>
                      {job.orders.order_reference}
                    </Link>
                  ) : (
                    <small>{formatDisplayValue(job.source_type)} enquiry</small>
                  )}
                  <p>
                    <small>{formatMelbourneDateTime(job.created_at)}</small>
                  </p>
                </td>
                <td style={{ padding: "18px 12px", verticalAlign: "top" }}>
                  {formatDisplayValue(job.status)}
                  <p>{job.attempts} attempts</p>
                  {job.status === "failed" ? (
                    <small>
                      Retry after {formatMelbourneDateTime(job.next_attempt_at)}
                    </small>
                  ) : null}
                  {job.last_error ? (
                    <p className="form-error">{job.last_error}</p>
                  ) : null}
                </td>
                <td
                  style={{
                    padding: "18px 12px",
                    maxWidth: 280,
                    overflowWrap: "anywhere",
                    verticalAlign: "top",
                  }}
                >
                  <small>Provider ID</small>
                  <p>{job.provider_message_id || "No acceptance recorded"}</p>
                  <small>Message-ID</small>
                  <p>
                    {job.smtp_message_id ||
                      "<outbox-" + job.id + "@artbyelyzaveta.shop>"}
                  </p>
                </td>
                <td
                  style={{
                    padding: "18px 12px",
                    minWidth: 240,
                    verticalAlign: "top",
                  }}
                >
                  {["needs_review", "dead", "failed"].includes(job.status) ? (
                    <NotificationReconciliation id={job.id} />
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!jobs.data.length ? (
        <p>No notification jobs have been created yet.</p>
      ) : null}
    </section>
  );
}
