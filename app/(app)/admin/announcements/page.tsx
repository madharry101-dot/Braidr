"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Select, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { LoadingBlock } from "@/components/ui/spinner";
import { useAnnouncements, useSendAnnouncement } from "@/lib/hooks/admin";
import { ApiError } from "@/lib/api/client";
import { formatDateTime } from "@/lib/format";
import { UK_CITIES } from "@/lib/types/braidmatch";

export default function AdminAnnouncementsPage() {
  const send = useSendAnnouncement();
  const { data: history, isLoading } = useAnnouncements();

  const [role, setRole] = useState("");
  const [city, setCity] = useState("");
  const [proOnly, setProOnly] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    const segment: Record<string, unknown> = {};
    if (role) segment.role = role;
    if (city) segment.city = city;
    if (proOnly) segment.braidr_pro_subscribed = true;
    try {
      const res = await send.mutateAsync({
        segment,
        subject: subject.trim(),
        message: message.trim(),
      });
      setResult(`Sent to ${res.recipient_count} recipient${res.recipient_count === 1 ? "" : "s"}.`);
      setSubject("");
      setMessage("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send that.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Announcements" subtitle="Email a segment of users, or everyone." />

      <Card>
        <form onSubmit={submit} className="flex flex-col gap-4">
          {result && <Alert tone="success">{result}</Alert>}
          {error && <Alert tone="error">{error}</Alert>}

          <div className="grid gap-3 sm:grid-cols-2">
            <Select label="Role" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="">Everyone</option>
              <option value="client">Clients</option>
              <option value="braider">Braiders</option>
              <option value="expert">Experts</option>
            </Select>
            <Select label="City" value={city} onChange={(e) => setCity(e.target.value)}>
              <option value="">Any city</option>
              {UK_CITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
          {role === "braider" && (
            <label className="flex items-center gap-2 text-sm text-plum">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={proOnly}
                onChange={(e) => setProOnly(e.target.checked)}
              />
              Braidr Pro subscribers only
            </label>
          )}

          <Input
            label="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={200}
            required
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="msg" className="text-sm font-medium text-plum">
              Message
            </label>
            <textarea
              id="msg"
              rows={5}
              maxLength={5000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full rounded border border-mist bg-white px-3 py-2 text-plum"
              required
            />
          </div>

          <Button
            type="submit"
            loading={send.isPending}
            disabled={!subject.trim() || !message.trim()}
            className="sm:!w-auto"
          >
            Send
          </Button>
        </form>
      </Card>

      <section>
        <h2 className="mb-3 font-display text-lg text-plum">Sent</h2>
        {isLoading && <LoadingBlock />}
        {history && history.length === 0 && <p className="text-sm text-slate">Nothing sent yet.</p>}
        <div className="flex flex-col gap-3">
          {history?.map((a) => (
            <Card key={a.id}>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">{a.subject}</CardTitle>
                <Badge tone="neutral">{a.recipient_count} sent</Badge>
              </div>
              <p className="mt-1 text-xs text-slate">
                {formatDateTime(a.created_at)}
                {Object.keys(a.segment).length > 0 &&
                  ` · ${Object.entries(a.segment)
                    .map(([k, v]) => `${k}=${v}`)
                    .join(", ")}`}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate">{a.message}</p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
