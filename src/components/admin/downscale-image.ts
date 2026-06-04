// Client-side image optimization run before upload. Staff often pick
// straight-from-phone photos (10+ MB, 6000px wide, EXIF-rotated); this
// caps the longest edge, re-encodes to WebP, and fixes orientation so the
// object we STORE is already web-ready. Plan-independent (no Supabase
// image-transformation cost) and immutable once stored.
//
// Degrades safely: if the browser can't decode the file (e.g. HEIC in
// Chrome) or anything throws, it returns the original File and lets the
// server-side MIME/size validation handle it.

export interface DownscaleOptions {
  maxEdge: number; // longest side, in px
  quality?: number; // 0..1, WebP quality (default 0.82)
}

export async function downscaleImage(
  file: File,
  { maxEdge, quality = 0.82 }: DownscaleOptions,
): Promise<File> {
  // GIF (possibly animated) and SVG (vector) don't survive a canvas
  // round-trip — leave them untouched.
  if (file.type === "image/gif" || file.type === "image/svg+xml") return file;

  try {
    // imageOrientation:"from-image" bakes EXIF rotation into the pixels so
    // the stored image is upright (canvas otherwise ignores EXIF).
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const { width, height } = bitmap;
    const scale = Math.min(1, maxEdge / Math.max(width, height));
    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", quality),
    );
    if (!blob) return file;

    // If re-encoding didn't actually help (already-tiny WebP), keep the
    // smaller of the two.
    if (blob.size >= file.size && scale === 1) return file;

    const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
    return new File([blob], `${baseName}.webp`, { type: "image/webp" });
  } catch {
    return file; // undecodable — let the server validate the original
  }
}
