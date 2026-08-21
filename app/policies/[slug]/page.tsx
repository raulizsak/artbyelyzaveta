import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { notFound } from "next/navigation";
import { PolicyContent } from "@/components/policy-content";
import { POLICIES, policyBySlug } from "@/lib/policies";

type Props = { params: Promise<{ slug: string }> };
export function generateStaticParams() {
  return POLICIES.map((policy) => ({ slug: policy.slug }));
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const policy = policyBySlug((await params).slug);
  return policy
    ? {
        title: policy.title,
        description: `${policy.title} for Art by Elyzaveta.`,
      }
    : {};
}
export default async function PolicyPage({ params }: Props) {
  const policy = policyBySlug((await params).slug);
  if (!policy) notFound();
  return (
    <main className="policy-page shell" id="main-content">
      <nav aria-label="Breadcrumb" className="product-breadcrumb">
        <Link href="/">Home</Link>
        <ChevronRight aria-hidden="true" size={13} />
        <span>Policies</span>
        <ChevronRight aria-hidden="true" size={13} />
        <span>{policy.title}</span>
      </nav>
      <header>
        <p className="eyebrow">Policies</p>
        <h1>{policy.title}</h1>
        <p>Last updated: {policy.updated}</p>
      </header>
      <PolicyContent content={policy.content} />
      <aside className="policy-help">
        <p className="eyebrow">Need help?</p>
        <h2>
          If you have a question about this policy, contact Art by Elyzaveta.
        </h2>
        <Link className="cta-link" href="/contact">
          Contact Us
        </Link>
      </aside>
      <nav aria-label="Related policies" className="related-policies">
        <strong>Related policies</strong>
        {policy.related.map((slug) => {
          const related = policyBySlug(slug);
          return related ? (
            <Link href={`/policies/${slug}`} key={slug}>
              {related.title}
            </Link>
          ) : null;
        })}
      </nav>
    </main>
  );
}
