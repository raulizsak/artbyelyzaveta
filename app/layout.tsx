import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import { SiteChrome } from "@/components/site-chrome";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

const display = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600"],
});

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} | Original Paintings`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  robots:
    process.env.ENABLE_SEARCH_INDEXING === "true"
      ? { index: true, follow: true }
      : { index: false, follow: false },
  openGraph: {
    title: `${SITE_NAME} | Original Paintings`,
    description: SITE_DESCRIPTION,
    locale: "en_AU",
    type: "website",
    images: [
      {
        url: "/optimized/artwork/cows-at-dusk-warm-room-main.webp",
        width: 1122,
        height: 1402,
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html data-scroll-behavior="smooth" lang="en-AU">
      <body className={`${display.variable} ${sans.variable}`}>
        <Providers>
          <SiteChrome>{children}</SiteChrome>
        </Providers>
      </body>
    </html>
  );
}
