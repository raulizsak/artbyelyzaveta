import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Brush, Frame, ShieldCheck } from "lucide-react";
import SmoothButton from "@/components/ui/smoothui/smooth-button";
import { COWS_AT_DUSK, formatMoney, paintingDimensions } from "@/lib/catalog";

export default function HomePage() {
  const painting = COWS_AT_DUSK;
  return (
    <main id="main-content">
      <section className="hero shell">
        <div className="hero__copy">
          <p className="eyebrow">Oil paintings · Melbourne, Australia</p>
          <h1>Original oil paintings by a Ukrainian artist.</h1>
          <p className="hero__lede">
            Moody landscapes painted in oil to bring calm, warmth and a sense of
            place into your home.
          </p>
          <div className="button-row">
            <SmoothButton
              asChild
              className="cta cta--primary"
              size="lg"
              variant="solid"
            >
              <Link href="/shop">Shop Original Paintings</Link>
            </SmoothButton>
            <SmoothButton
              asChild
              className="cta cta--secondary"
              size="lg"
              variant="outline"
            >
              <Link href="/commissions">Commission a Painting</Link>
            </SmoothButton>
          </div>
        </div>
        <div className="hero__art">
          <div className="hero__frame">
            <Image
              alt={painting.media[0].alt}
              height={1080}
              priority
              sizes="(max-width: 800px) 94vw, 56vw"
              src={painting.media[0].src}
              width={1080}
            />
          </div>
          <p>
            <em>{painting.title}</em> · {painting.medium} on{" "}
            {painting.surface.toLowerCase()}
          </p>
        </div>
      </section>

      <section className="trust-strip shell" aria-label="Artwork assurances">
        <span>
          <Brush aria-hidden="true" /> One-of-one original
        </span>
        <span>
          <Frame aria-hidden="true" /> Ready to hang
        </span>
        <span>
          <ShieldCheck aria-hidden="true" /> Certificate included
        </span>
      </section>

      <section className="featured shell">
        <div className="section-heading">
          <div>
            <p className="eyebrow">One-of-one</p>
            <h2>Available Paintings</h2>
          </div>
          <Link className="text-link" href="/shop">
            Shop all <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </div>
        <div className="featured__grid">
          <Image
            alt={painting.media[1].alt}
            className="featured__image"
            height={1402}
            sizes="(max-width: 800px) 100vw, 58vw"
            src={painting.media[1].src}
            width={1122}
          />
          <div className="featured__details">
            <span className="availability">
              <i /> One original available
            </span>
            <h3>{painting.title}</h3>
            <p>{paintingDimensions(painting)}</p>
            <p>
              {painting.medium} on {painting.surface.toLowerCase()}
            </p>
            <strong>{formatMoney(painting.price)}</strong>
            <Link className="view-painting" href={`/shop/${painting.slug}`}>
              View Painting <ArrowRight aria-hidden="true" size={18} />
            </Link>
          </div>
        </div>
      </section>

      <section className="editorial-split shell">
        <div className="editorial-split__image">
          <Image
            alt="Elyzaveta standing in a leafy garden"
            fill
            sizes="(max-width: 800px) 100vw, 48vw"
            src="/artist/lisa-portrait.jpg"
          />
        </div>
        <div className="editorial-split__copy">
          <p className="eyebrow">Meet the artist</p>
          <h2>Paintings shaped by place, feeling and patient observation.</h2>
          <p>
            Elyzaveta creates original works from Melbourne, with a focus on
            atmosphere and the emotional pull of landscape. Each painting is
            made as a singular object for a home that values art with presence.
          </p>
          <Link className="view-painting" href="/about">
            About Elyzaveta <ArrowRight aria-hidden="true" size={18} />
          </Link>
        </div>
      </section>

      <section className="commission-banner shell">
        <div>
          <p className="eyebrow">Made for your story</p>
          <h2>Have a place or memory you would love painted?</h2>
        </div>
        <div className="commission-banner__process">
          <p className="eyebrow">How it works</p>
          <ol>
            <li>
              <span>01</span>
              <div>
                <strong>Share your idea</strong>
                <p>
                  Tell Lisa about the place, memory, atmosphere or image you
                  would like painted.
                </p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>Receive a personal quote</strong>
                <p>
                  Size, complexity, timing and pricing are considered
                  individually.
                </p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>Approve &amp; begin</strong>
                <p>
                  If you would like to proceed, the commission is confirmed
                  before work begins.
                </p>
              </div>
            </li>
          </ol>
          <p className="commission-banner__prompt">
            Begin with a considered, no-pressure enquiry.
          </p>
          <SmoothButton
            asChild
            className="cta cta--secondary-light"
            size="lg"
            variant="outline"
          >
            <Link href="/commissions">
              Explore Commission <ArrowRight aria-hidden="true" size={17} />
            </Link>
          </SmoothButton>
        </div>
      </section>

      <section className="studio-note shell">
        <p className="eyebrow">From the studio</p>
        <h2>A quiet space for process, new work and works in progress.</h2>
        <p>Studio notes will appear here as the collection grows.</p>
      </section>
    </main>
  );
}
