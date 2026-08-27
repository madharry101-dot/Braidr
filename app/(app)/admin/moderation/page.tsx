"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { LoadingBlock } from "@/components/ui/spinner";
import { useModerationLog } from "@/lib/hooks/admin";
import { formatDateTime } from "@/lib/format";

function RemovalForm() {
  const [kind, setKind] = useState<"portfolio" | "avatar">("portfolio");
  const [targetId, setTargetId] = useState("");
  const [photoIndex, setPhotoIndex] = useState("0");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    setBusy(true);
    try {
      const url =
        kind === "portfolio"
          ? `/api/admin/content/portfolio/${targetId}/${photoIndex}`
          : `/api/admin/content/avatar/${targetId}`;
      const res = await fetch(url, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? "Removal failed.");
        return;
      }
      setMsg("Removed and logged.");
      setTargetId("");
      setReason("");
    } catch {
      setError("Removal failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardTitle className="text-base">Remove content</CardTitle>
      <p className="mt-1 text-sm text-slate">
        Braidr has no user-reporting queue — this is for content an admin finds directly while
        reviewing a profile.
      </p>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
        {msg && <Alert tone="success">{msg}</Alert>}
        {error && <Alert tone="error">{error}</Alert>}
        <div className="flex gap-2">
          {(["portfolio", "avatar"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={
                "min-h-[44px] flex-1 rounded border px-3 text-sm font-medium " +
                (kind === k ? "border-plum bg-plum text-white" : "border-mist bg-white text-plum")
              }
            >
              {k === "portfolio" ? "Portfolio photo" : "Avatar"}
            </button>
          ))}
        </div>
        <Input
          label={kind === "portfolio" ? "Braider profile ID" : "User ID"}
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          required
        />
        {kind === "portfolio" && (
          <Input
            label="Photo index (0-based)"
            type="number"
            min={0}
            value={photoIndex}
            onChange={(e) => setPhotoIndex(e.target.value)}
          />
        )}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="mod-reason" className="text-sm font-medium text-plum">
            Reason
          </label>
          <textarea
            id="mod-reason"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded border border-mist bg-white px-3 py-2 text-sm text-plum"
            required
          />
        </div>
        <Button
          type="submit"
          variant="danger"
          size="sm"
          className="sm:!w-auto"
          loading={busy}
          disabled={!targetId.trim() || !reason.trim()}
        >
          Remove
        </Button>
      </form>
    </Card>
  );
}

export default function AdminModerationPage() {
  const { data: log, isLoading, isError } = useModerationLog();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Moderation" subtitle="Content removals and their audit trail." />

      <RemovalForm />

      <section>
        <h2 className="mb-3 font-display text-lg text-plum">Removal log</h2>
        {isLoading && <LoadingBlock />}
        {isError && <Alert tone="error">Couldn&rsquo;t load the log.</Alert>}
        {log && log.length === 0 && <p className="text-sm text-slate">Nothing removed yet.</p>}
        <div className="flex flex-col gap-3">
          {log?.map((e) => (
            <Card key={e.id}>
              <div className="flex items-center justify-between gap-2">
                <Badge tone="neutral">{e.target_type.replace("_", " ")}</Badge>
                <span className="text-xs text-slate">{formatDateTime(e.created_at)}</span>
              </div>
              <p className="mt-2 text-sm text-plum">{e.reason}</p>
              <p className="mt-1 break-all text-xs text-slate">
                user {e.target_user_id} · {e.removed_path}
              </p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
