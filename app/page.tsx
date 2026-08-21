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
          <p className="eyebrow">Original art · Melbourne, Australia</p>
          <h1>Original paintings, created slowly and made to last.</h1>
          <p className="hero__lede">
            Original paintings inspired by atmosphere, landscape and the quiet
            beauty of everyday places.
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
            <h2>Available Original</h2>
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
            alt={painting.media[2].alt}
            fill
            sizes="(max-width: 800px) 100vw, 48vw"
            src={painting.media[2].src}
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
        <div>
          <p>
            Begin with a considered, no-pressure enquiry. Share the feeling,
            scale and setting you have in mind.
          </p>
          <SmoothButton
            asChild
            className="cta cta--secondary-light"
            size="lg"
            variant="outline"
          >
            <Link href="/commissions">Explore commissions</Link>
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
