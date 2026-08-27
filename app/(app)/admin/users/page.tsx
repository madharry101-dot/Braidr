"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Select, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { LoadingBlock } from "@/components/ui/spinner";
import { useAdminUsers, useSuspendUser, useDeleteUser } from "@/lib/hooks/admin";
import { ApiError } from "@/lib/api/client";
import { formatDate } from "@/lib/format";
import type { AdminUser } from "@/lib/types/admin";

function UserRow({ user }: { user: AdminUser }) {
  const suspend = useSuspendUser();
  const del = useDeleteUser();
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (
      !window.confirm(
        `Remove ${user.full_name}? Users with booking history are anonymised, not deleted.`
      )
    )
      return;
    setError(null);
    try {
      const res = await del.mutateAsync(user.id);
      setMsg(res.mode === "deleted" ? "Account deleted." : `Anonymised — ${res.reason ?? ""}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't remove that user.");
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-mist bg-surface p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium text-plum">{user.display_name ?? user.full_name}</p>
          <Badge tone="neutral">{user.role}</Badge>
          {user.is_suspended && <Badge tone="danger">Suspended</Badge>}
        </div>
        <p className="text-sm text-slate">
          {user.city ?? "—"} · joined {formatDate(user.created_at)}
        </p>
        {msg && <p className="mt-1 text-sm text-success">{msg}</p>}
        {error && <p className="mt-1 text-sm text-danger">{error}</p>}
      </div>
      <div className="flex shrink-0 gap-2">
        <Button
          variant="secondary"
          size="sm"
          className="sm:!w-auto"
          loading={suspend.isPending}
          onClick={() => suspend.mutate({ id: user.id, suspended: !user.is_suspended })}
        >
          {user.is_suspended ? "Unsuspend" : "Suspend"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="sm:!w-auto"
          loading={del.isPending}
          onClick={remove}
        >
          Remove
        </Button>
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  const [role, setRole] = useState("");
  const [search, setSearch] = useState("");
  const {
    data: users,
    isLoading,
    isError,
  } = useAdminUsers({
    role: role || undefined,
    search: search || undefined,
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Users" subtitle="Search, suspend or remove any account." />

      <div className="grid gap-3 sm:grid-cols-2">
        <Select label="Role" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">All roles</option>
          <option value="client">Client</option>
          <option value="braider">Braider</option>
          <option value="expert">Expert</option>
          <option value="admin">Admin</option>
        </Select>
        <Input
          label="Search by name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Start typing…"
        />
      </div>

      {isLoading && <LoadingBlock />}
      {isError && <Alert tone="error">Couldn&rsquo;t load users.</Alert>}
      {users && users.length === 0 && <p className="text-sm text-slate">No users match.</p>}
      {users && users.length > 0 && (
        <div className="flex flex-col gap-3">
          {users.map((u) => (
            <UserRow key={u.id} user={u} />
          ))}
        </div>
      )}
    </div>
  );
}
