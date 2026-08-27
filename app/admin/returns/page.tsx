import { AdminReturnActions } from "@/components/admin-return-actions";
import { requireAdminAal2 } from "@/lib/auth/authorization";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function Page() {
  await requireAdminAal2("/admin/returns");
  const admin = createAdminClient();
  const { data } = await admin
    .from("return_requests")
    .select(
      "*, orders(order_reference, customer_first_name, customer_last_name, customer_email), return_evidence(storage_path)",
    )
    .order("created_at", { ascending: false })
    .limit(50);
  const requests = await Promise.all(
    (data ?? []).map(async (request) => {
      const evidence = request.return_evidence as unknown as {
        storage_path: string;
      }[];
      const signedUrls = await Promise.all(
        evidence.map(
          async (file) =>
            (
              await admin.storage
                .from("return-evidence")
                .createSignedUrl(file.storage_path, 300)
            ).data?.signedUrl,
        ),
      );
      const urls = signedUrls.filter(
        (url): url is string => typeof url === "string",
      );
      return { ...request, evidenceUrls: urls };
    }),
  );
  return (
    <section className="account-panel">
      <p className="eyebrow">Returns</p>
      <h1>Return queue</h1>
      {requests.length ? (
        <div className="return-admin-list">
          {requests.map((request) => {
            const order = request.orders as unknown as {
              order_reference: string;
              customer_first_name: string;
              customer_last_name: string;
              customer_email: string;
            };
            return (
              <article className="return-admin-card" key={request.id}>
                <div className="section-heading">
                  <div>
                    <strong>{order.order_reference}</strong>
                    <p>
                      {order.customer_first_name} {order.customer_last_name} ·{" "}
                      {order.customer_email}
                    </p>
                  </div>
                  <span>{request.status}</span>
                </div>
                <h2>{request.reason}</h2>
                <p>{request.explanation}</p>
                {request.evidenceUrls.length ? (
                  <div className="evidence-grid">
                    {request.evidenceUrls.map((url) => (
                      <a href={url} key={url} rel="noreferrer" target="_blank">
                        View private evidence
                      </a>
                    ))}
                  </div>
                ) : null}
                <AdminReturnActions
                  initialStatus={request.status}
                  maximumCents={request.requested_refund_cents}
                  returnId={request.id}
                />
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <h2>No return requests</h2>
          <p>New customer requests will appear here.</p>
        </div>
      )}
    </section>
  );
}
