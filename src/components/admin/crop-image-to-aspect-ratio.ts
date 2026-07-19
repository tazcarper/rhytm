// Client-side center-crop to a fixed aspect ratio, run before
// downscaleImage. Kept separate from that function on purpose — cropping
// changes composition (what's in frame), downscaling changes resolution
// (how many pixels); composing two small single-purpose steps beats one
// function doing both. Same canvas technique as the reference mockup's
// cropTo169/cropTo (temporary-resources/front-end-beta/_reference/event-builder).
//
// Degrades safely: undecodable input (e.g. HEIC in Chrome) returns the
// original file untouched, same convention as downscaleImage.

export async function cropImageToAspectRatio(file: File, ratio: number): Promise<File> {
  if (file.type === "image/gif" || file.type === "image/svg+xml") return file;

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const { width, height } = bitmap;
    const sourceRatio = width / height;

    let cropWidth = width;
    let cropHeight = height;
    let sx = 0;
    let sy = 0;

    if (sourceRatio > ratio) {
      // Too wide — trim the sides.
      cropWidth = Math.round(height * ratio);
      sx = Math.round((width - cropWidth) / 2);
    } else if (sourceRatio < ratio) {
      // Too tall — trim top/bottom.
      cropHeight = Math.round(width / ratio);
      sy = Math.round((height - cropHeight) / 2);
    }

    const canvas = document.createElement("canvas");
    canvas.width = cropWidth;
    canvas.height = cropHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, sx, sy, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, file.type === "image/png" ? "image/png" : "image/jpeg", 0.92),
    );
    if (!blob) return file;

    const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
    const extension = blob.type === "image/png" ? "png" : "jpg";
    return new File([blob], `${baseName}.${extension}`, { type: blob.type });
  } catch {
    return file;
  }
}
