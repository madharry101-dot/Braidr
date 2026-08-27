"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { TagInput } from "@/components/ui/tag-input";
import { RequireBraiderProfile } from "@/components/braider/require-profile";
import { useUpdateBraiderProfile, useDeletePortfolioPhoto } from "@/lib/hooks/braider-dashboard";
import { ApiError, type ApiEnvelope } from "@/lib/api/client";
import { publicStorageUrl } from "@/lib/storage";
import { STYLE_OPTIONS, UK_CITIES, type MyBraiderProfile } from "@/lib/types/braidmatch";

const MAX_PHOTOS = 12;

function ProfileForm({ profile }: { profile: MyBraiderProfile }) {
  const update = useUpdateBraiderProfile(profile.id);
  const deletePhoto = useDeletePortfolioPhoto(profile.id);
  const qc = useQueryClient();

  const [bio, setBio] = useState(profile.bio ?? "");
  const [city, setCity] = useState(profile.city);
  const [area, setArea] = useState(profile.area ?? "");
  const [specialisations, setSpecialisations] = useState<string[]>(profile.specialisations);
  const [years, setYears] = useState(profile.years_experience?.toString() ?? "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    try {
      await update.mutateAsync({
        bio: bio.trim(),
        city,
        area: area.trim(),
        specialisations,
        years_experience: years ? Number(years) : undefined,
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save. Please try again.");
    }
  }

  async function uploadPhotos(files: FileList) {
    setUploadError(null);
    setUploading(true);
    try {
      const form = new FormData();
      Array.from(files).forEach((f) => form.append("photos", f));
      const res = await fetch(`/api/braiders/${profile.id}/portfolio-photos`, {
        method: "POST",
        body: form,
      });
      const payload = (await res.json()) as ApiEnvelope<{ portfolio_photos: string[] }>;
      if (!payload.success) {
        setUploadError(payload.error.message);
        return;
      }
      qc.invalidateQueries({ queryKey: ["braider", "me"] });
    } catch {
      setUploadError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Your profile"
        subtitle="This is what clients see in search and on your profile page."
      />

      <Card>
        <form onSubmit={save} className="flex flex-col gap-4" noValidate>
          {error && <Alert tone="error">{error}</Alert>}
          {saved && <Alert tone="success">Profile saved.</Alert>}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="bio" className="text-sm font-medium text-plum">
              Bio
            </label>
            <textarea
              id="bio"
              rows={4}
              maxLength={2000}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell clients about your style, experience and what makes your work stand out."
              className="placeholder:text-slate/60 w-full rounded border border-mist bg-white px-3 py-2 text-plum focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="City" value={city} onChange={(e) => setCity(e.target.value)}>
              {UK_CITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <Input
              label="Area"
              placeholder="e.g. Peckham"
              value={area}
              onChange={(e) => setArea(e.target.value)}
            />
          </div>

          <TagInput
            label="Styles you offer"
            value={specialisations}
            onChange={setSpecialisations}
            suggestions={STYLE_OPTIONS}
          />

          <Input
            label="Years of experience"
            type="number"
            min={0}
            max={80}
            value={years}
            onChange={(e) => setYears(e.target.value)}
          />

          <Button type="submit" loading={update.isPending} className="sm:!w-auto">
            Save profile
          </Button>
        </form>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg text-plum">Portfolio</h2>
          <span className="text-sm text-slate">
            {profile.portfolio_photos.length}/{MAX_PHOTOS}
          </span>
        </div>

        {uploadError && (
          <Alert tone="error" className="mt-3">
            {uploadError}
          </Alert>
        )}

        {profile.portfolio_photos.length > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {profile.portfolio_photos.map((path, i) => (
              <div
                key={path}
                className="group relative aspect-square overflow-hidden rounded-lg bg-mist"
              >
                <Image
                  src={publicStorageUrl("portfolio-photos", path)}
                  alt={`Portfolio ${i + 1}`}
                  fill
                  sizes="(max-width: 768px) 33vw, 25vw"
                  className="object-cover"
                />
                <button
                  type="button"
                  onClick={() => deletePhoto.mutate(i)}
                  aria-label={`Remove photo ${i + 1}`}
                  className="bg-plum/80 absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full text-sm text-white"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) uploadPhotos(e.target.files);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-4 sm:!w-auto"
          disabled={uploading || profile.portfolio_photos.length >= MAX_PHOTOS}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? (
            <>
              <Spinner className="h-4 w-4" /> Uploading…
            </>
          ) : (
            "Add photos"
          )}
        </Button>
      </Card>
    </div>
  );
}

export default function BraiderProfilePage() {
  return (
    <RequireBraiderProfile>{(me) => <ProfileForm profile={me.profile} />}</RequireBraiderProfile>
  );
}
