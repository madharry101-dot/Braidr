"use client";

import { useRef, useState } from "react";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { ApiError, type ApiEnvelope } from "@/lib/api/client";
import { renderMarkdown } from "@/lib/blog/markdown";
import { BLOG_CATEGORIES, BLOG_CATEGORY_META, type BlogCategory } from "@/lib/blog/types";
import type { BlogPostInput } from "@/lib/hooks/blog";

// Shared create/edit form. Markdown source with a live preview rendered by
// exactly the same function the public page uses, so what an author checks
// is what a reader gets.

export function PostEditor({
  initial,
  submitLabel,
  onSubmit,
  pending,
}: {
  initial?: Partial<BlogPostInput>;
  submitLabel: string;
  onSubmit: (input: BlogPostInput) => Promise<unknown>;
  pending: boolean;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [category, setCategory] = useState<BlogCategory>(initial?.category ?? "educational");
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // Upload, then drop the Markdown at the caret rather than appending —
  // an author placing an image mid-article shouldn't have to cut and paste
  // it up from the bottom. Falls back to appending when the textarea isn't
  // focused (e.g. the image button was clicked straight from preview).
  async function insertImage(file: File) {
    setUploadError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("image", file);
      const res = await fetch("/api/blog/images", { method: "POST", body: form });
      const payload = (await res.json()) as ApiEnvelope<{ url: string }>;
      if (!payload.success) {
        setUploadError(payload.error.message);
        return;
      }

      const alt = file.name.replace(/\.[^.]+$/, "").replace(/[[\]()]/g, "");
      const snippet = `\n\n![${alt}](${payload.data.url})\n\n`;
      const el = bodyRef.current;
      const at = el && document.activeElement === el ? el.selectionStart : body.length;
      const next = body.slice(0, at) + snippet + body.slice(at);
      setBody(next);
      setPreview(false);

      // Restore the caret after the inserted snippet on the next paint.
      requestAnimationFrame(() => {
        const caret = at + snippet.length;
        el?.focus();
        el?.setSelectionRange(caret, caret);
      });
    } catch {
      setUploadError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    try {
      await onSubmit({ title: title.trim(), excerpt: excerpt.trim(), body, category });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save. Please try again.");
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
      {error && <Alert tone="error">{error}</Alert>}
      {saved && <Alert tone="success">Saved.</Alert>}

      <Card>
        <div className="flex flex-col gap-4">
          <Input
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            required
          />
          <Select
            label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value as BlogCategory)}
            hint={BLOG_CATEGORY_META[category].blurb}
          >
            {BLOG_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {BLOG_CATEGORY_META[c].label}
              </option>
            ))}
          </Select>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="excerpt" className="text-sm font-medium text-plum">
              Excerpt
            </label>
            <textarea
              id="excerpt"
              rows={3}
              maxLength={400}
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="Two or three lines. Used on the article list and in the newsletter email."
              className="placeholder:text-slate/60 w-full rounded border border-mist bg-white px-3 py-2 text-plum focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
              required
            />
            <p className="text-sm text-slate">{excerpt.length}/400</p>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-lg">Body</CardTitle>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="sm:!w-auto"
              disabled={uploading}
              onClick={() => imageRef.current?.click()}
            >
              {uploading ? (
                <>
                  <Spinner className="h-4 w-4" /> Uploading…
                </>
              ) : (
                "Insert image"
              )}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="sm:!w-auto"
              onClick={() => setPreview((v) => !v)}
            >
              {preview ? "Edit" : "Preview"}
            </Button>
          </div>
        </div>
        <p className="mt-1 text-sm text-slate">
          Markdown: <code>##</code> headings, <code>**bold**</code>, <code>*italic*</code>,{" "}
          <code>[links](url)</code>, <code>-</code> lists, <code>&gt;</code> quotes. Raw HTML is not
          rendered.
        </p>

        <input
          ref={imageRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) insertImage(file);
            e.target.value = "";
          }}
        />

        {uploadError && (
          <Alert tone="error" className="mt-3">
            {uploadError}
          </Alert>
        )}

        {preview ? (
          <div
            className="blog-body mt-4 rounded border border-mist bg-white p-4"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }}
          />
        ) : (
          <textarea
            ref={bodyRef}
            aria-label="Post body"
            rows={22}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="placeholder:text-slate/60 mt-4 w-full rounded border border-mist bg-white px-3 py-2 font-mono text-sm text-plum focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
            placeholder={"## A heading\n\nYour first paragraph.\n"}
            required
          />
        )}
      </Card>

      {/* The same rule BraidCare runs on. Worth stating where the writing
          actually happens, not only in a style guide nobody has open. */}
      <Alert tone="info">
        <b className="font-medium text-plum">Before you submit:</b> keep the language observational,
        never diagnostic. Describe what something looks like and when to see a professional —
        don&rsquo;t name conditions or tell readers what they have.
      </Alert>

      <div>
        <Button type="submit" loading={pending} className="sm:!w-auto">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
