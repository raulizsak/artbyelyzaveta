import "server-only";

const required = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

export const isSupabaseConfigured = () =>
  Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim(),
  );

export const getSupabasePublicConfig = () => ({
  url: required("NEXT_PUBLIC_SUPABASE_URL"),
  publishableKey: required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
});

export const getSupabaseSecretKey = () =>
  process.env.SUPABASE_SECRET_KEY?.trim() ||
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
  required("SUPABASE_SECRET_KEY");

export const isStripeTestConfigured = () =>
  Boolean(
    process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_") &&
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.startsWith("pk_test_"),
  );

export const isLiveCheckoutEnabled = () =>
  process.env.ENABLE_LIVE_CHECKOUT === "true";

export const isTestCheckoutEnabled = () =>
  process.env.ENABLE_TEST_CHECKOUT === "true" && isStripeTestConfigured();

export const isDemoPaymentMode = () => process.env.PAYMENT_MODE === "demo";
