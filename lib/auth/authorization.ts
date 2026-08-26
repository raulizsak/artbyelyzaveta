import "server-only";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type AccountProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  role: "customer" | "admin";
  stripe_customer_id: string | null;
};

export type AccountIdentity = {
  id: string;
  email: string;
  emailVerified: boolean;
  aal: "aal1" | "aal2";
  profile: AccountProfile;
};

function claimString(claims: Record<string, unknown>, key: string) {
  const value = claims[key];
  return typeof value === "string" ? value : "";
}

export async function getAccountIdentity(): Promise<AccountIdentity | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) return null;

  const claims = data.claims as Record<string, unknown>;
  const id = claimString(claims, "sub");
  const email = claimString(claims, "email").trim().toLowerCase();
  if (!id || !email) return null;

  const { data: profileData } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, phone, role, stripe_customer_id")
    .eq("id", id)
    .maybeSingle();

  let profile = profileData as AccountProfile | null;
  const verified =
    Boolean(claimString(claims, "email_verified")) ||
    Boolean(claims.email_verified);
  const bootstrapEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();

  if (
    profile?.role !== "admin" &&
    verified &&
    bootstrapEmail &&
    email === bootstrapEmail
  ) {
    const admin = createAdminClient();
    const { data: promoted } = await admin
      .from("profiles")
      .update({ role: "admin" })
      .eq("id", id)
      .select("id, first_name, last_name, phone, role, stripe_customer_id")
      .single();
    profile = promoted as AccountProfile | null;
  }

  if (!profile) return null;

  return {
    id,
    email,
    emailVerified: verified,
    aal: claimString(claims, "aal") === "aal2" ? "aal2" : "aal1",
    profile,
  };
}

export async function requireAccount(nextPath = "/account") {
  const identity = await getAccountIdentity();
  if (!identity) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return identity;
}

export async function requireAdminAal2(nextPath = "/admin") {
  const identity = await requireAccount(nextPath);
  if (identity.profile.role !== "admin") redirect("/account");
  if (identity.aal !== "aal2") {
    redirect(`/account/security?next=${encodeURIComponent(nextPath)}`);
  }
  return identity;
}
