import { ProfileForm } from "@/features/settings/profile-form";
import { requireSession } from "@/lib/session/session";

export const metadata = { title: "Profile" };

export default async function Page() {
  const { user } = await requireSession();
  return (
    <section aria-labelledby="profile-heading" className="flex flex-col gap-4">
      <h2 id="profile-heading" className="text-2xl font-semibold">
        Profile
      </h2>
      <ProfileForm
        fullName={user.fullName}
        email={user.email}
        role={user.role}
      />
    </section>
  );
}
