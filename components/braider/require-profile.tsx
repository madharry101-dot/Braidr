"use client";

import Link from "next/link";
import { LoadingBlock } from "@/components/ui/spinner";
import { Alert } from "@/components/ui/alert";
import { useBraiderMe } from "@/lib/hooks/braider-dashboard";
import type { BraiderMe } from "@/lib/types/braidmatch";

// Wraps the braider sub-pages that can't do anything useful until the
// braider_profiles row exists. The row is created on the dashboard home.
export function RequireBraiderProfile({
  children,
}: {
  children: (me: BraiderMe & { profile: NonNullable<BraiderMe["profile"]> }) => React.ReactNode;
}) {
  const { data: me, isLoading, isError } = useBraiderMe();

  if (isLoading) return <LoadingBlock />;
  if (isError || !me) return <Alert tone="error">Couldn&rsquo;t load your dashboard.</Alert>;

  if (!me.profile) {
    return (
      <Alert tone="info">
        Set up your braider profile first.{" "}
        <Link href="/dashboard/braider" className="font-medium underline">
          Go to your dashboard
        </Link>
        .
      </Alert>
    );
  }

  return <>{children(me as BraiderMe & { profile: NonNullable<BraiderMe["profile"]> })}</>;
}
