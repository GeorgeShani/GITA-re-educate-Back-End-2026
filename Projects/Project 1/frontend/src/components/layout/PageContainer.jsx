import { cn } from "@/utils/cn";

// Gutters confirmed exact via the Navbar frames (node 361:12208/12209/12224):
// mobile 343px content in a 375px frame (px-4/16px), tablet 704px in 768px
// (px-8/32px), desktop 1170px in 1440px (px-33.75/135px). `desktop:max-w-360`
// (1440px) replaces the earlier max-w-7xl (1280px) placeholder, which was
// narrower than the 1440px desktop reference frame and would have clipped
// the gutter down to 1010px instead of the confirmed 1170px.
export function PageContainer({ children, className }) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-7xl px-4 tablet:px-8 desktop:max-w-360 desktop:px-33.75",
        className,
      )}
    >
      {children}
    </div>
  );
}
