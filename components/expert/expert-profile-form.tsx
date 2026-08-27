"use client";

import { useRef, useState } from "react";
import { Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { TagInput } from "@/components/ui/tag-input";
import { useCreateExpertProfile } from "@/lib/hooks/expert";
import { SPECIALISATION_OPTIONS } from "@/lib/types/expert";
import { UK_CITIES } from "@/lib/types/braidmatch";

export function ExpertProfileForm({ onDone }: { onDone: () => void }) {
  const create = useCreateExpertProfile();
  const [credentials, setCredentials] = useState("");
  const [specialisation, setSpecialisation] = useState<string[]>([]);
  const [clinic, setClinic] = useState("");
  const [city, setCity] = useState("");
  const [fee, setFee] = useState("");
  const [bookingUrl, setBookingUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Upload a credential document (registration certificate, qualification, etc.).");
      return;
    }
    const form = new FormData();
    form.append("credentials", credentials.trim());
    form.append("city", city);
    if (clinic.trim()) form.append("clinic_name", clinic.trim());
    if (specialisation.length) form.append("specialisation", specialisation.join(","));
    if (fee) form.append("consultation_fee_pence", String(Math.round(parseFloat(fee) * 100)));
    if (bookingUrl.trim()) form.append("booking_url", bookingUrl.trim());
    form.append("credential_document", file);

    try {
      await create.mutateAsync(form);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't submit your profile.");
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {error && <Alert tone="error">{error}</Alert>}
      <Input
        label="Credentials"
        placeholder="e.g. Consultant Dermatologist, GMC 1234567"
        hint="Shown publicly on your directory listing."
        value={credentials}
        onChange={(e) => setCredentials(e.target.value)}
        required
      />
      <TagInput
        label="Specialisations"
        value={specialisation}
        onChange={setSpecialisation}
        suggestions={SPECIALISATION_OPTIONS}
        placeholder="Type a specialisation and press Enter"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Clinic name (optional)"
          value={clinic}
          onChange={(e) => setClinic(e.target.value)}
        />
        <Select label="City" value={city} onChange={(e) => setCity(e.target.value)} required>
          <option value="">Select a city</option>
          {UK_CITIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Consultation fee from (£, optional)"
          type="number"
          min={0}
          step="0.01"
          value={fee}
          onChange={(e) => setFee(e.target.value)}
        />
        <Input
          label="Booking link (optional)"
          type="url"
          placeholder="https://"
          value={bookingUrl}
          onChange={(e) => setBookingUrl(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-plum">Credential document</span>
        <label className="flex min-h-[44px] w-full cursor-pointer items-center justify-center rounded border border-dashed border-mist bg-white px-4 text-sm text-teal-deep hover:border-plum sm:w-auto">
          {fileName ?? "Upload PDF, JPG or PNG"}
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            className="hidden"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          />
        </label>
        <p className="text-xs text-slate">
          Only Braidr admins can see this — it&rsquo;s used for verification and never shown
          publicly.
        </p>
      </div>

      <Button type="submit" size="lg" loading={create.isPending} disabled={!credentials || !city}>
        {create.isPending ? (
          <>
            <Spinner className="h-4 w-4" /> Submitting…
          </>
        ) : (
          "Submit for review"
        )}
      </Button>
    </form>
  );
}
