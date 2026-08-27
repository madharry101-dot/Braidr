"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Logo } from "@/components/brand/logo";
import { NAV_BY_ROLE, type NavItem } from "@/components/nav/nav-items";
import { api } from "@/lib/api/client";
import { useSession } from "@/lib/hooks/use-session";
import { cn } from "@/lib/cn";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session, isLoading } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();

  const role = session?.profile?.role;
  const items: NavItem[] = role ? NAV_BY_ROLE[role] : [];

  // Client-side guard for app routes middleware doesn't cover (/account,
  // /bookings, /braiders, /braidcare). Middleware still owns /dashboard/*
  // and /admin server-side.
  useEffect(() => {
    if (!isLoading && !session) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [isLoading, session, router, pathname]);

  if (isLoading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span
          aria-label="Loading"
          className="h-6 w-6 animate-spin rounded-full border-2 border-plum border-t-transparent"
        />
      </div>
    );
  }

  async function signOut() {
    await api.post("/auth/logout");
    queryClient.clear();
    router.replace("/login");
  }

  return (
    <div className="min-h-screen">
      {/* Top bar — md and up (PRD 6.3: top nav replaces bottom tabs at >=768) */}
      <header className="bg-cream/90 sticky top-0 z-30 border-b border-mist backdrop-blur">
        <div className="mx-auto flex h-16 max-w-content items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-8">
            <Logo href={role ? NAV_BY_ROLE[role][0].href : "/"} />
            <nav className="hidden md:flex md:items-center md:gap-1">
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive(pathname, item.href) ? "page" : undefined}
                  className={cn(
                    "rounded px-3 py-2 text-sm font-medium",
                    isActive(pathname, item.href)
                      ? "bg-white text-plum shadow-card"
                      : "text-slate hover:text-plum"
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {!isLoading && session?.profile && (
              <span className="hidden text-sm text-slate sm:inline">
                {session.profile.display_name ?? session.profile.full_name}
              </span>
            )}
            <button
              onClick={signOut}
              className="hover:bg-mist/50 min-h-[44px] rounded px-3 text-sm font-medium text-teal-deep"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-content px-4 pb-24 pt-6 md:pb-12 lg:px-8">{children}</main>

      {/* Bottom tab bar — below md */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-mist bg-white md:hidden"
      >
        <ul className="mx-auto flex max-w-content">
          {items.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-[56px] flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium",
                    active ? "text-plum" : "text-slate"
                  )}
                >
                  <Icon className={cn("h-6 w-6", active && "text-gold-deep")} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
