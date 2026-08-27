import { AppShell } from "@/components/nav/app-shell";

// Authenticated area. Route groups keep the marketing pages and auth pages
// out of this shell. `middleware.ts` enforces role access server-side for
// /dashboard/* and /admin; AppShell handles the softer redirects.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
