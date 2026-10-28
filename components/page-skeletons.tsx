import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";

function Pending({
  children,
  label = "Loading page",
}: {
  children: ReactNode;
  label?: string;
}) {
  return (
    <div aria-busy="true" className="page-skeleton" role="status">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true">{children}</div>
    </div>
  );
}
function Intro() {
  return (
    <header className="skeleton-intro">
      <Skeleton className="skeleton-eyebrow" />
      <Skeleton className="skeleton-heading" />
      <Skeleton className="skeleton-description" />
    </header>
  );
}
function Lines({ count = 4 }: { count?: number }) {
  return (
    <div className="skeleton-lines">
      {Array.from({ length: count }, (_, index) => (
        <Skeleton
          className={
            index === count - 1
              ? "skeleton-line skeleton-line--short"
              : "skeleton-line"
          }
          key={index}
        />
      ))}
    </div>
  );
}
function Fields({ count = 6 }: { count?: number }) {
  return (
    <div className="skeleton-fields">
      {Array.from({ length: count }, (_, index) => (
        <div key={index}>
          <Skeleton className="skeleton-label" />
          <Skeleton className="skeleton-input" />
        </div>
      ))}
    </div>
  );
}
export function CatalogueSkeleton() {
  return (
    <Pending label="Loading collection">
      <div className="catalogue-toolbar skeleton-toolbar">
        <Skeleton className="skeleton-input" />
        <Skeleton className="skeleton-input" />
        <Skeleton className="skeleton-input" />
      </div>
      <div className="catalogue-results">
        <Skeleton className="skeleton-label" />
      </div>
      <div className="catalogue-grid">
        {Array.from({ length: 8 }, (_, index) => (
          <div className="painting-card" key={index}>
            <Skeleton className="painting-card__image" />
            <div className="skeleton-card-copy">
              <Skeleton className="skeleton-card-title" />
              <Skeleton className="skeleton-label" />
              <Lines count={2} />
            </div>
          </div>
        ))}
      </div>
    </Pending>
  );
}
export function ShopPageSkeleton() {
  return (
    <main className="page-shell shop-page shell" id="main-content">
      <Intro />
      <CatalogueSkeleton />
    </main>
  );
}
export function DetailPageSkeleton() {
  return (
    <main className="shell skeleton-detail" id="main-content">
      <Pending label="Loading artwork">
        <Skeleton className="skeleton-label" />
        <div className="product-layout">
          <div>
            <Skeleton className="skeleton-artwork" />
            <div className="skeleton-thumbnails">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} />
              ))}
            </div>
          </div>
          <div>
            <Intro />
            <Lines />
            <Skeleton className="skeleton-price" />
            <Fields count={2} />
            <Skeleton className="skeleton-input" />
          </div>
        </div>
      </Pending>
    </main>
  );
}
export function EditorialPageSkeleton() {
  return (
    <main className="page-shell shell" id="main-content">
      <Pending>
        <div className="skeleton-split">
          <div>
            <Intro />
            <Lines count={6} />
            <Skeleton className="skeleton-input" />
          </div>
          <Skeleton className="skeleton-artwork" />
        </div>
      </Pending>
    </main>
  );
}
export function HomePageSkeleton() {
  return <EditorialPageSkeleton />;
}
export function ComingSoonSkeleton() {
  return (
    <main className="coming-soon" id="main-content">
      <Pending>
        <div className="coming-soon__card">
          <Intro />
          <Lines />
          <Skeleton className="skeleton-input" />
        </div>
      </Pending>
    </main>
  );
}
export function FormPageSkeleton() {
  return (
    <main className="page-shell shell" id="main-content">
      <Pending label="Loading form">
        <Intro />
        <div className="skeleton-split">
          <div>
            <Fields />
            <Skeleton className="skeleton-textarea" />
            <Skeleton className="skeleton-input" />
          </div>
          <Lines />
        </div>
      </Pending>
    </main>
  );
}
export function AuthPageSkeleton() {
  return (
    <main className="auth-page shell" id="main-content">
      <Pending label="Loading secure form">
        <div className="skeleton-auth">
          <Intro />
          <Fields count={3} />
          <Skeleton className="skeleton-input" />
        </div>
      </Pending>
    </main>
  );
}
export function ArticlePageSkeleton() {
  return (
    <main className="page-shell shell" id="main-content">
      <Pending>
        <div className="skeleton-article">
          <Intro />
          <Lines count={8} />
          <Lines count={6} />
          <Lines count={8} />
        </div>
      </Pending>
    </main>
  );
}
export function CheckoutPageSkeleton() {
  return (
    <main className="checkout-page shell" id="main-content">
      <Pending label="Loading secure checkout">
        <Intro />
        <div className="checkout-layout">
          <div>
            <Skeleton className="skeleton-input" />
            <Fields />
            <Skeleton className="skeleton-input" />
          </div>
          <div className="checkout-summary">
            <Skeleton className="skeleton-order-image" />
            <Lines />
            <Skeleton className="skeleton-price" />
          </div>
        </div>
      </Pending>
    </main>
  );
}
export function CartPageSkeleton() {
  return (
    <main className="page-shell shell" id="main-content">
      <Pending label="Loading bag">
        <Intro />
        <div className="cart-page-layout">
          <div>
            <Skeleton className="skeleton-order-image" />
            <Lines />
          </div>
          <div className="order-summary">
            <Lines />
            <Skeleton className="skeleton-price" />
            <Skeleton className="skeleton-input" />
          </div>
        </div>
      </Pending>
    </main>
  );
}
export function CartContentSkeleton() {
  return (
    <Pending label="Loading saved selection">
      <Intro />
      <div className="cart-page-layout">
        <div>
          <Skeleton className="skeleton-order-image" />
          <Lines />
        </div>
        <div className="order-summary">
          <Lines />
          <Skeleton className="skeleton-price" />
          <Skeleton className="skeleton-input" />
        </div>
      </div>
    </Pending>
  );
}
export function OrderPageSkeleton() {
  return (
    <main className="page-shell shell" id="main-content">
      <Pending label="Loading order status">
        <div className="skeleton-article">
          <Intro />
          <Skeleton className="skeleton-input" />
          <Lines count={6} />
          <Skeleton className="skeleton-order-image" />
        </div>
      </Pending>
    </main>
  );
}
export function DashboardSkeleton() {
  return (
    <Pending label="Loading dashboard">
      <Intro />
      <div className="skeleton-stats">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="skeleton-panel" key={index}>
            <Skeleton className="skeleton-label" />
            <Skeleton className="skeleton-price" />
          </div>
        ))}
      </div>
      <Skeleton className="skeleton-chart" />
      <TableRows />
    </Pending>
  );
}
function TableRows() {
  return (
    <div className="skeleton-table">
      {Array.from({ length: 7 }, (_, index) => (
        <div key={index}>
          <Skeleton />
          <Skeleton />
          <Skeleton />
        </div>
      ))}
    </div>
  );
}
export function TableSkeleton() {
  return (
    <Pending label="Loading records">
      <Intro />
      <Skeleton className="skeleton-input" />
      <TableRows />
    </Pending>
  );
}
export function EditorSkeleton() {
  return (
    <Pending label="Loading editor">
      <Intro />
      <div className="skeleton-split">
        <div>
          <Fields count={8} />
          <Skeleton className="skeleton-textarea" />
        </div>
        <Skeleton className="skeleton-artwork" />
      </div>
    </Pending>
  );
}
export function AccountSkeleton() {
  return (
    <Pending label="Loading account">
      <Intro />
      <Fields count={4} />
      <Lines />
      <Skeleton className="skeleton-input" />
    </Pending>
  );
}
export function RecordSkeleton() {
  return (
    <Pending label="Loading record">
      <Intro />
      <div className="skeleton-split">
        <div>
          <Skeleton className="skeleton-order-image" />
          <Lines count={6} />
        </div>
        <div>
          <Fields count={4} />
          <Lines />
        </div>
      </div>
    </Pending>
  );
}
export function AdminPortalSkeleton() {
  return (
    <main className="admin-portal" id="main-content">
      <aside className="skeleton-sidebar" aria-hidden="true">
        <Lines count={8} />
      </aside>
      <section className="admin-workspace">
        <div className="admin-workspace__content">
          <DashboardSkeleton />
        </div>
      </section>
    </main>
  );
}
export function AccountPortalSkeleton() {
  return (
    <main className="dashboard-shell shell" id="main-content">
      <aside className="skeleton-sidebar" aria-hidden="true">
        <Lines count={6} />
      </aside>
      <div className="dashboard-content">
        <AccountSkeleton />
      </div>
    </main>
  );
}
