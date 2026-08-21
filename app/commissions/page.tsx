import type { Metadata } from "next";
import Image from "next/image";
import { CommissionForm } from "@/components/commission-form";

export const metadata: Metadata = {
  title: "Commission a Painting",
  description:
    "Enquire about commissioning a one-of-one original painting by Elyzaveta Izsak.",
};
export default function CommissionsPage() {
  return (
    <main id="main-content">
      <section className="commission-hero shell">
        <div>
          <p className="eyebrow">Commission a painting</p>
          <h1>A meaningful place, made lasting.</h1>
          <p>
            Commission an original oil painting shaped around a landscape,
            memory or atmosphere that matters to you.
          </p>
          <a className="cta-link" href="#commission-form">
            Begin your enquiry
          </a>
        </div>
        <Image
          alt="Cows at Dusk displayed in a warm neutral home"
          height={1402}
          priority
          sizes="(max-width: 800px) 100vw, 52vw"
          src="/artwork/cows-at-dusk-warm-room.png"
          width={1122}
        />
      </section>
      <section className="process-section shell">
        <p className="eyebrow">The process</p>
        <div>
          <article>
            <span>01</span>
            <h2>Share the idea</h2>
            <p>
              Tell Elyzaveta about the place, mood, preferred scale and timing.
            </p>
          </article>
          <article>
            <span>02</span>
            <h2>Shape the brief</h2>
            <p>
              Scope, references, availability, pricing and terms are confirmed
              personally.
            </p>
          </article>
          <article>
            <span>03</span>
            <h2>Create & deliver</h2>
            <p>
              The painting is created, reviewed at agreed milestones and
              carefully delivered.
            </p>
          </article>
        </div>
      </section>
      <section className="commission-form-section shell" id="commission-form">
        <div>
          <p className="eyebrow">Start the conversation</p>
          <h2>Tell me what you have in mind.</h2>
          <p>
            This enquiry is exploratory and does not create a booking.
            Commission availability and terms are confirmed in writing.
          </p>
        </div>
        <CommissionForm />
      </section>
    </main>
  );
}
