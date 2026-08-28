import Link from "next/link";
import { requireAdminAal2 } from "@/lib/auth/authorization";
import { formatMelbourneDateTime } from "@/lib/date-time";
import { formatDisplayValue } from "@/lib/presentation";
import { createAdminClient } from "@/lib/supabase/admin";

const PAGE_SIZE = 30;

export default async function SubscribersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await requireAdminAal2("/admin/subscribers");
  const params = await searchParams;
  const search = (params.q ?? "").trim().slice(0, 160);
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  let query = createAdminClient()
    .from("subscribers")
    .select("id, email, status, source, subscribed_at", { count: "exact" })
    .order("subscribed_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  if (search) query = query.ilike("email", `%${search.replaceAll("%", "")}%`);
  const { data, count } = await query;
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <section className="account-panel">
      <p className="eyebrow">Launch audience</p>
      <h1>Subscribers</h1>
      <p>{count ?? 0} people on the coming-soon list.</p>
      <form className="admin-search" method="get">
        <label className="form-field">
          <span>Search email</span>
          <input defaultValue={search} name="q" type="search" />
        </label>
        <button className="secondary-action" type="submit">
          Search
        </button>
      </form>
      <div className="order-list">
        {data?.map((subscriber) => (
          <article className="order-card" key={subscriber.id}>
            <span>
              <strong>{subscriber.email}</strong>
              <small>{subscriber.source}</small>
            </span>
            <span>
              <strong>{formatDisplayValue(subscriber.status)}</strong>
              <small>{formatMelbourneDateTime(subscriber.subscribed_at)}</small>
            </span>
          </article>
        ))}
        {!data?.length ? <p>No subscribers found.</p> : null}
      </div>
      <nav className="button-row" aria-label="Subscriber pages">
        {page > 1 ? (
          <Link
            className="secondary-action"
            href={`/admin/subscribers?q=${encodeURIComponent(search)}&page=${page - 1}`}
          >
            Previous
          </Link>
        ) : null}
        <span>
          Page {Math.min(page, pages)} of {pages}
        </span>
        {page < pages ? (
          <Link
            className="secondary-action"
            href={`/admin/subscribers?q=${encodeURIComponent(search)}&page=${page + 1}`}
          >
            Next
          </Link>
        ) : null}
      </nav>
    </section>
  );
}
