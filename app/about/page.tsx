import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "About Elyzaveta",
  description:
    "Meet Melbourne artist Elyzaveta Izsak and discover the ideas behind her original paintings.",
};
export default function AboutPage() {
  return (
    <main id="main-content">
      <section className="about-hero shell">
        <div>
          <p className="eyebrow">About the artist</p>
          <h1>Painting the atmosphere of a place.</h1>
          <p>
            Elyzaveta Izsak is a Melbourne-based artist creating original
            paintings inspired by landscape, memory and quiet observation.
          </p>
        </div>
        <div className="artist-portrait">
          <Image
            alt="Portrait of Elyzaveta in a leafy garden"
            fill
            priority
            sizes="(max-width: 900px) 100vw, 42vw"
            src="/artist/lisa-portrait.jpg"
          />
        </div>
      </section>
      <section className="about-story shell">
        <div>
          <Image
            alt="Cows at Dusk in a warm interior"
            height={1402}
            sizes="(max-width: 800px) 100vw, 45vw"
            src="/artwork/cows-at-dusk-classic-room.png"
            width={1122}
          />
        </div>
        <div>
          <p className="eyebrow">The work</p>
          <h2>Art with a sense of stillness and presence.</h2>
          <p>
            Each work begins with the feeling of a place: a shift in light, an
            open horizon or a scene that asks to be remembered. Elyzaveta builds
            these moments in oil, allowing colour, texture and atmosphere to
            develop slowly.
          </p>
          <p>
            The result is a singular painting intended to live with its
            collector for years. Every original is accompanied by a certificate
            of authenticity.
          </p>
          <Link className="view-painting" href="/shop">
            View available work <ArrowRight aria-hidden="true" size={18} />
          </Link>
        </div>
      </section>
      <section className="values-section shell">
        <p className="eyebrow">Studio values</p>
        <div>
          <article>
            <span>01</span>
            <h2>Originality</h2>
            <p>Every painting is a one-of-one work made by hand.</p>
          </article>
          <article>
            <span>02</span>
            <h2>Attention</h2>
            <p>Time, observation and thoughtful craft guide the process.</p>
          </article>
          <article>
            <span>03</span>
            <h2>Connection</h2>
            <p>
              Collectors are invited into a personal, considered experience.
            </p>
          </article>
        </div>
      </section>
      <section className="page-cta shell">
        <p className="eyebrow">A painting of your own</p>
        <h2>Commission a place, memory or atmosphere that matters to you.</h2>
        <Link className="cta-link" href="/commissions">
          Begin a commission enquiry
        </Link>
      </section>
    </main>
  );
}
