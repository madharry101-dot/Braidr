import { Logo } from "@/components/brand/logo";
import { SiteFooter } from "@/components/brand/site-footer";

// Public shell — same shape as the legal pages. The blog is readable
// without an account, so it deliberately doesn't use the (app) AppShell.
export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex h-16 w-full max-w-content items-center px-4 lg:px-8">
        <Logo />
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 lg:px-8">{children}</main>
      <SiteFooter />
    </div>
  );
}
