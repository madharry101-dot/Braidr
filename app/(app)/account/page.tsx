"use client";

import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { useSession } from "@/lib/hooks/use-session";

export default function AccountPage() {
  const { data: session } = useSession();
  const p = session?.profile;

  return (
    <div>
      <PageHeader title="Account" subtitle="Your profile and sign-in details." />
      <Card className="max-w-lg">
        <CardTitle>Profile</CardTitle>
        <dl className="mt-4 grid grid-cols-[8rem_1fr] gap-y-3 text-sm">
          <dt className="text-slate">Name</dt>
          <dd className="text-plum">{p?.full_name ?? "—"}</dd>
          <dt className="text-slate">Email</dt>
          <dd className="text-plum">{session?.user.email ?? "—"}</dd>
          <dt className="text-slate">Role</dt>
          <dd className="capitalize text-plum">{p?.role ?? "—"}</dd>
          <dt className="text-slate">City</dt>
          <dd className="text-plum">{p?.city ?? "Not set"}</dd>
        </dl>
      </Card>
    </div>
  );
}
