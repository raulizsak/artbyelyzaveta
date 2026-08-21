"use client";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="not-found shell" id="main-content">
      <p className="eyebrow">Something slipped from the easel</p>
      <h1>This page could not be shown.</h1>
      <p>Please try once more. Your bag is stored safely in this browser.</p>
      <button className="cta-link" onClick={reset} type="button">
        Try again
      </button>
    </main>
  );
}
