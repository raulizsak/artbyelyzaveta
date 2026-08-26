import { ProfileForm } from "@/components/profile-form";
import { requireAccount } from "@/lib/auth/authorization";
export default async function Page() {
  const user = await requireAccount("/account/profile");
  return (
    <ProfileForm
      initial={{
        firstName: user.profile.first_name ?? "",
        lastName: user.profile.last_name ?? "",
        phone: user.profile.phone ?? "",
        email: user.email,
      }}
    />
  );
}
