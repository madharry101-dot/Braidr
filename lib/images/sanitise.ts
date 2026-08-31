import sharp from "sharp";

/**
 * Re-encodes an uploaded image before it is ever written to storage.
 *
 * WHY THIS EXISTS (R-02)
 * Every upload route previously streamed `await file.arrayBuffer()` straight
 * into a bucket. Phone cameras write EXIF, and EXIF carries GPS. That meant:
 *   - scalp photos (private, 90-day retention) held the client's home
 *     coordinates, while the Privacy Policy §4.2 told them metadata was
 *     "stripped from every photograph before storage";
 *   - portfolio photos held the braider's — in a PUBLIC bucket, at a stable
 *     unauthenticated URL. Braidr's braiders largely work from home, so that
 *     is a home address, readable by anyone who opens the image.
 *
 * EXIF was already being stripped for the Anthropic call (lib/ai/braidcare.ts
 * preprocessImage), but only in memory, at analysis time. The stored object
 * was always the untouched original.
 *
 * WHAT A RE-ENCODE GIVES US
 * sharp drops all metadata (EXIF, GPS, IPTC, XMP) on re-encode unless
 * `.withMetadata()` is called, which we never call. Three things follow:
 *
 *   1. Metadata is gone by construction, not by a filter that could miss a
 *      container it didn't know about.
 *   2. The bytes are proven to be a decodable image. sharp throws on anything
 *      else, so this is magic-byte validation as a side effect — the declared
 *      `file.type` from the client is no longer trusted for anything (R-05).
 *   3. Dimensions are bounded, so a decompression bomb can't be stored.
 *
 * ORIENTATION — the trap in doing this naively.
 * A phone photo taken in portrait is usually stored as landscape pixels plus
 * an EXIF orientation tag telling the viewer to rotate it. Strip the metadata
 * without acting on that tag first and every such photo is stored sideways.
 * `.rotate()` with no argument applies the EXIF orientation to the pixels,
 * and must run BEFORE the metadata is discarded. That is the whole reason the
 * call is there — it is not a no-op.
 */

const MAX_DIMENSION = 2048;
const QUALITY = 85;

export type SanitisedImage = {
  buffer: Buffer;
  /** Derived from the decoded image, never from the client's declared type. */
  contentType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  ext: "jpg" | "png" | "webp" | "gif";
};

type Options = {
  /**
   * Accept GIF as well. Off by default: the photo surfaces (scalp, portfolio)
   * have no reason to take one. The blog image library did accept GIF before
   * this module existed, so it opts in rather than quietly losing the format.
   */
  allowGif?: boolean;
};

/**
 * Returns null when the bytes are not a decodable image in an accepted format.
 * Callers should treat null as a 422, not a 500 — it means the upload was bad,
 * not that we broke.
 *
 * The output format follows the input (JPEG stays JPEG, PNG stays PNG, WebP
 * stays WebP) so nothing about how an image looks or how transparency behaves
 * changes as a result of sanitising it.
 */
export async function sanitiseUploadedImage(
  input: ArrayBuffer,
  { allowGif = false }: Options = {}
): Promise<SanitisedImage | null> {
  const source = Buffer.from(input);

  let format: string | undefined;
  try {
    format = (await sharp(source).metadata()).format;
  } catch {
    // Not an image sharp can decode — a renamed .exe, a truncated file, an
    // SVG with script in it, a polyglot. Rejected here rather than stored.
    return null;
  }

  const resize = {
    width: MAX_DIMENSION,
    height: MAX_DIMENSION,
    fit: "inside" as const,
    withoutEnlargement: true,
  };

  try {
    // GIF is handled on its own path: it must be decoded with `animated` so a
    // multi-frame image doesn't collapse to its first frame, and it is not
    // rotated — the format has no EXIF orientation tag to apply, and sharp
    // will not rotate an animated image anyway.
    if (format === "gif") {
      if (!allowGif) return null;
      const buffer = await sharp(source, { animated: true }).resize(resize).gif().toBuffer();
      return { buffer, contentType: "image/gif", ext: "gif" };
    }

    const pipeline = sharp(source)
      .rotate() // see ORIENTATION above — must precede the metadata drop
      .resize(resize);

    switch (format) {
      case "png":
        return { buffer: await pipeline.png().toBuffer(), contentType: "image/png", ext: "png" };
      case "webp":
        return { buffer: await pipeline.webp({ quality: QUALITY }).toBuffer(), contentType: "image/webp", ext: "webp" }; // prettier-ignore
      case "jpeg":
        return { buffer: await pipeline.jpeg({ quality: QUALITY }).toBuffer(), contentType: "image/jpeg", ext: "jpg" }; // prettier-ignore
      default:
        // Decodable by sharp but not something we accept (tiff, avif, svg).
        return null;
    }
  } catch {
    return null;
  }
}
