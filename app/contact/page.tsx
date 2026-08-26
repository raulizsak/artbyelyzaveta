import type { Metadata } from "next";
import { Mail, MapPin } from "lucide-react";
import { ContactForm } from "@/components/contact-form";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Contact Art by Elyzaveta about an original painting, delivery or a general enquiry.",
};
export default function ContactPage() {
  return (
    <main className="form-page shell" id="main-content">
      <header className="page-intro">
        <p className="eyebrow">Contact</p>
        <h1>Let’s begin a conversation.</h1>
        <p>
          Ask about an original painting, delivery or anything else. A
          considered reply will follow.
        </p>
      </header>
      <div className="form-page__layout">
        <aside>
          <div>
            <Mail aria-hidden="true" />
            <h2>Email</h2>
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </div>
          <div>
            <MapPin aria-hidden="true" />
            <h2>Studio</h2>
            <p>
              Melbourne, Australia
              <br />
              Visits by prior arrangement only.
            </p>
          </div>
          <p className="response-note">
            Your enquiry is stored privately and used only to reply to your
            request.
          </p>
        </aside>
        <ContactForm />
      </div>
    </main>
  );
}
