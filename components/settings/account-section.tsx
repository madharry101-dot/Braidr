"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { api, ApiError } from "@/lib/api/client";
import { createClient } from "@/lib/supabase/client";

type Identity = { identity_id: string; provider: string };

// FR-AUTH-02.5 — link/unlink a Google account from Settings. Uses Supabase
// Auth manual identity linking (must be enabled in the project's Auth
// settings). Unlink is blocked when Google is the only sign-in method.
export function AccountSection({ email }: { email: string | undefined }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [identities, setIdentities] = useState<Identity[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [showDelete, setShowDelete] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function deleteAccount() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.del("/settings/account", { body: { confirm: "DELETE" } });
      queryClient.clear();
      router.replace("/login?deleted=1");
    } catch (err) {
      setDeleteError(
        err instanceof ApiError ? err.message : "Something went wrong. Please try again."
      );
      setDeleting(false);
    }
  }

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.auth.getUserIdentities();
    setIdentities(
      (data?.identities ?? []).map((i) => ({
        identity_id: i.identity_id ?? "",
        provider: i.provider,
      }))
    );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const google = identities?.find((i) => i.provider === "google");
  const hasPassword = identities?.some((i) => i.provider === "email");

  async function linkGoogle() {
    setError(null);
    setBusy(true);
    const supabase = createClient();
    const { error: linkError } = await supabase.auth.linkIdentity({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/settings` },
    });
    if (linkError) {
      setError(
        "Couldn't start Google linking. Your project may not have identity linking enabled."
      );
      setBusy(false);
    }
  }

  async function unlinkGoogle() {
    if (!google) return;
    setError(null);
    setBusy(true);
    const supabase = createClient();
    const full = (await supabase.auth.getUserIdentities()).data?.identities?.find(
      (i) => i.provider === "google"
    );
    if (!full) {
      setBusy(false);
      return;
    }
    const { error: unlinkError } = await supabase.auth.unlinkIdentity(full);
    if (unlinkError) {
      setError(unlinkError.message);
    } else {
      setNotice("Google account unlinked.");
      await load();
    }
    setBusy(false);
  }

  return (
    <Card>
      <CardTitle>Account</CardTitle>

      <dl className="mt-3 grid grid-cols-[7rem_1fr] gap-y-2 text-sm">
        <dt className="text-slate">Email</dt>
        <dd className="text-plum">{email ?? "—"}</dd>
      </dl>

      <div className="mt-4 flex flex-col gap-3">
        <div>
          <p className="text-sm font-medium text-plum">Password</p>
          <Link
            href="/forgot-password"
            className="text-sm text-teal-deep underline hover:text-plum"
          >
            {hasPassword ? "Change your password" : "Set a password"}
          </Link>
        </div>

        <div>
          <p className="text-sm font-medium text-plum">Linked accounts</p>
          {error && (
            <Alert tone="error" className="mt-2">
              {error}
            </Alert>
          )}
          {notice && (
            <Alert tone="success" className="mt-2">
              {notice}
            </Alert>
          )}
          {identities === null ? (
            <p className="text-sm text-slate">Loading…</p>
          ) : google ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-slate">Google — connected</span>
              <Button
                size="sm"
                variant="secondary"
                loading={busy}
                disabled={!hasPassword}
                onClick={unlinkGoogle}
                className="sm:!w-auto"
              >
                {hasPassword ? "Unlink" : "Only sign-in method"}
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              loading={busy}
              onClick={linkGoogle}
              className="mt-1 sm:!w-auto"
            >
              Connect Google
            </Button>
          )}
        </div>

        <div className="border-t border-mist pt-3">
          <p className="text-sm font-medium text-plum">Delete account</p>
          {!showDelete ? (
            <button
              type="button"
              onClick={() => setShowDelete(true)}
              className="text-sm text-danger underline hover:opacity-80"
            >
              Delete my account
            </button>
          ) : (
            <div className="border-danger/40 bg-danger-bg/40 mt-1 rounded border p-3 text-sm">
              <p className="text-plum">
                This permanently deletes your Braidr account and personal data within 30 days. Some
                records (such as payment records) may be retained longer where we are legally
                required to keep them — see our{" "}
                <Link href="/privacy" className="underline hover:text-plum">
                  Privacy Policy
                </Link>
                .
              </p>
              {deleteError && (
                <Alert tone="error" className="mt-2">
                  {deleteError}
                </Alert>
              )}
              <div className="mt-3">
                <Input
                  label='Type "DELETE" to confirm'
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="danger"
                  loading={deleting}
                  disabled={confirmText !== "DELETE"}
                  onClick={deleteAccount}
                  className="sm:!w-auto"
                >
                  Permanently delete my account
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDelete(false);
                    setConfirmText("");
                  }}
                  className="min-h-[44px] text-sm font-medium text-teal-deep underline"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
