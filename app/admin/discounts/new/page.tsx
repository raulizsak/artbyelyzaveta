import { DiscountEditor } from "@/components/discount-editor";
import { requireAdminAal2 } from "@/lib/auth/authorization";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function Page() {
  await requireAdminAal2("/admin/discounts/new");
  const { data: paintings } = await createAdminClient()
    .from("paintings")
    .select("id, title, status")
    .order("title");
  return <DiscountEditor paintings={paintings ?? []} />;
}
