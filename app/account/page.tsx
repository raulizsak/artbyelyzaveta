import Link from "next/link";
import { requireAccount } from "@/lib/auth/authorization";
export default async function Page() {
  const user = await requireAccount();
  return (
    <section className="account-panel">
      <p className="eyebrow">Account overview</p>
      <h1>
        Hello{user.profile.first_name ? `, ${user.profile.first_name}` : ""}.
      </h1>
      <p>
        Track orders, manage delivery details, access invoices and keep your
        account secure.
      </p>
      <div className="dashboard-cards">
        <Link href="/account/orders">
          <strong>Orders</strong>
          <span>Current and previous purchases</span>
        </Link>
        <Link href="/account/returns">
          <strong>Returns</strong>
          <span>Requests and updates</span>
        </Link>
        <Link href="/account/security">
          <strong>Security</strong>
          <span>Password and two-step verification</span>
        </Link>
      </div>
    </section>
  );
}
