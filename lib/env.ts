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

export type StripeMode = "test" | "live";

export const getPaymentMode = (): "demo" | StripeMode => {
  const value = process.env.PAYMENT_MODE?.trim().toLowerCase();
  return value === "live" || value === "test" ? value : "demo";
};

export const getStripeSecretKey = (mode: StripeMode) => {
  const named = process.env[
    mode === "live" ? "STRIPE_LIVE_SECRET_KEY" : "STRIPE_TEST_SECRET_KEY"
  ]?.trim();
  const legacy =
    mode === "test" && process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_")
      ? process.env.STRIPE_SECRET_KEY.trim()
      : undefined;
  return named || legacy || null;
};

export const getStripePublishableKey = (mode: StripeMode) => {
  const named = process.env[
    mode === "live"
      ? "NEXT_PUBLIC_STRIPE_LIVE_PUBLISHABLE_KEY"
      : "NEXT_PUBLIC_STRIPE_TEST_PUBLISHABLE_KEY"
  ]?.trim();
  const legacy =
    mode === "test" &&
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.startsWith("pk_test_")
      ? process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.trim()
      : undefined;
  return named || legacy || null;
};

export const isStripeModeConfigured = (mode: StripeMode) => {
  const secret = getStripeSecretKey(mode);
  const publishable = getStripePublishableKey(mode);
  return Boolean(
    secret?.startsWith(mode === "live" ? "sk_live_" : "sk_test_") &&
      publishable?.startsWith(mode === "live" ? "pk_live_" : "pk_test_"),
  );
};

export const isStripeTestConfigured = () => isStripeModeConfigured("test");

export const isLiveCheckoutEnabled = () =>
  process.env.ENABLE_LIVE_CHECKOUT === "true";

export const isTestCheckoutEnabled = () =>
  process.env.ENABLE_TEST_CHECKOUT === "true" && isStripeTestConfigured();

export const isStripeCheckoutEnabled = (mode = getPaymentMode()) =>
  mode === "test"
    ? isTestCheckoutEnabled()
    : mode === "live"
      ? isLiveCheckoutEnabled() && isStripeModeConfigured("live")
      : false;

export const isDemoPaymentMode = () => getPaymentMode() === "demo";
