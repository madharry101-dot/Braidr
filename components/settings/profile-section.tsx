"use client";

import { useEffect, useState } from "react";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { useSettingsProfile, useUpdateSettingsProfile } from "@/lib/hooks/settings";
import { UK_CITIES } from "@/lib/types/braidmatch";

const HAIR_TYPES = ["Not set", "Type 1", "Type 2", "Type 3", "Type 4", "Prefer not to say"];

export function ProfileSection() {
  const { data, isLoading } = useSettingsProfile();
  const update = useUpdateSettingsProfile();

  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [dob, setDob] = useState("");
  const [hairType, setHairType] = useState("Not set");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setDisplayName(data.display_name ?? "");
    setPhone(data.phone ?? "");
    setCity(data.city ?? "");
    setDob(data.date_of_birth ?? "");
    setHairType(data.hair_type ?? "Not set");
  }, [data]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    try {
      await update.mutateAsync({
        display_name: displayName.trim() || null,
        phone: phone.trim() || null,
        city: city || null,
        date_of_birth: dob || null,
        hair_type: hairType === "Not set" ? null : hairType,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("Couldn't save your profile. Please try again.");
    }
  }

  if (isLoading || !data) return <Card>Loading…</Card>;
  const isClient = data.role === "client";

  return (
    <Card>
      <CardTitle>Profile</CardTitle>
      <p className="mt-1 text-sm text-slate">
        Your name is <span className="text-plum">{data.full_name}</span>. Contact support to change
        it.
      </p>
      <form onSubmit={save} className="mt-4 flex flex-col gap-4" noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        {saved && <Alert tone="success">Saved.</Alert>}
        <Input
          label="Display name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          hint="Shown around Braidr instead of your full name."
        />
        <Input
          label="Phone number"
          type="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <Select label="City / area" value={city} onChange={(e) => setCity(e.target.value)}>
          <option value="">Not set</option>
          {UK_CITIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        {isClient && (
          <>
            <Input
              label="Date of birth (optional)"
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
            />
            <Select
              label="Hair type (optional)"
              value={hairType}
              onChange={(e) => setHairType(e.target.value)}
            >
              {HAIR_TYPES.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </Select>
          </>
        )}
        <Button type="submit" size="sm" loading={update.isPending} className="sm:!w-auto">
          Save profile
        </Button>
      </form>
    </Card>
  );
}
