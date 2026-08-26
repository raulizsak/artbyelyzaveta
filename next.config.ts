import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    formats: ["image/avif", "image/webp"],
    // All storefront images are pre-optimized before upload. This avoids
    // runtime Sharp work and protects the 512 MB Render Free instance.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "fhxgcvdwvagqnxgydyca.supabase.co",
        pathname: "/storage/v1/object/public/artwork-public/**",
      },
    ],
  },
  async headers() {
    const supabase = "https://*.supabase.co wss://*.supabase.co";
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""} https://js.stripe.com`,
      "style-src 'self' 'unsafe-inline'",
      `connect-src 'self' ${supabase} https://api.stripe.com`,
      "frame-src https://js.stripe.com https://hooks.stripe.com",
      `img-src 'self' data: blob: https://*.supabase.co`,
      "font-src 'self' data:",
      ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
