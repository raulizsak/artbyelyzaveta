import { PaymentMethodsManager } from "@/components/payment-methods-manager";
import { requireAccount } from "@/lib/auth/authorization";
import { isTestCheckoutEnabled } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export default async function Page() {
  await requireAccount("/account/payment-methods");
  const { data } = await (await createClient())
    .from("payment_methods")
    .select("id, brand, last4, exp_month, exp_year, is_default")
    .order("is_default", { ascending: false });
  return (
    <PaymentMethodsManager
      enabled={isTestCheckoutEnabled()}
      initial={data ?? []}
    />
  );
}
