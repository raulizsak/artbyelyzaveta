import { AddressBook } from "@/components/address-book";
import { requireAccount } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
export default async function Page() {
  const user = await requireAccount("/account/addresses");
  const { data } = await (await createClient())
    .from("customer_addresses")
    .select(
      "id, label, recipient_name, line1, line2, suburb, state, postcode, country, is_default",
    )
    .order("is_default", { ascending: false });
  return (
    <AddressBook
      defaultRecipient={[user.profile.first_name, user.profile.last_name]
        .filter(Boolean)
        .join(" ")}
      initial={(data ?? []) as never[]}
    />
  );
}
