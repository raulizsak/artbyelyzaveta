import type { Metadata } from "next";
import { Suspense } from "react";
import { ShopCatalogue } from "@/components/shop-catalogue";
import { getPaintings } from "@/lib/catalog-data";

export const metadata: Metadata = {
  title: "Shop Original Paintings",
  description: "Browse available original paintings by Elyzaveta Izsak.",
};

export default async function ShopPage() {
  const paintings = await getPaintings();
  return (
    <main className="page-shell shell" id="main-content">
      <header className="page-intro">
        <p className="eyebrow">The collection</p>
        <h1>Original Paintings</h1>
        <p>One-of-one works, painted by hand in Melbourne.</p>
      </header>
      <Suspense
        fallback={
          <div className="catalogue-skeleton" aria-label="Loading collection" />
        }
      >
        <ShopCatalogue paintings={paintings} />
      </Suspense>
    </main>
  );
}
