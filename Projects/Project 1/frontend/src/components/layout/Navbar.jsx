import { PageContainer } from "@/components/layout/PageContainer";
import { Logo } from "@/components/ui/Logo";
import { ProfileMenu } from "@/components/layout/ProfileMenu";

// Figma "Navbar" (desktop 361:12208, tablet 361:12209, mobile 361:12224):
// logo left, profile-icon trigger right. py-10 (40px) is identical across all
// 3 breakpoints; horizontal alignment reuses PageContainer so the navbar's
// gutters match the page content beneath it.
export function Navbar({ avatarSrc, onProfileUpdated }) {
  return (
    <div className="w-full bg-transparent">
      <PageContainer className="flex items-center justify-between py-10">
        <Logo />
        <ProfileMenu avatarSrc={avatarSrc} onProfileUpdated={onProfileUpdated} />
      </PageContainer>
    </div>
  );
}
