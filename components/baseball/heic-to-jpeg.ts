/**
 * Convert HEIC/HEIF picks from iPhone Photos to JPEG before box-score upload.
 * Workers AI vision does not reliably accept image/heic — so we convert client-side.
 *
 * Prefer native decode (Safari on iPhone often handles HEIC via ImageBitmap /
 * HTMLImageElement + canvas). Fall back to heic2any (WASM) only when native fails.
 */

const HEIC_MIME = /^(image\/heic|image\/heif)$/i;
const HEIC_EXT = /\.(heic|heif)$/i;
const JPEG_QUALITY = 0.92;

declare module 'heic2any' {
  type Heic2AnyOptions = {
    blob: Blob;
    toType?: string;
    quality?: number;
    multiple?: boolean;
  };
  export default function heic2any(options: Heic2AnyOptions): Promise<Blob | Blob[]>;
}

export function isHeicLike(file: File): boolean {
  const type = (file.type || '').trim();
  if (type !== '' && HEIC_MIME.test(type)) return true;
  // iOS sometimes sends an empty or generic type — trust the extension.
  if (HEIC_EXT.test(file.name || '')) return true;
  return false;
}

function jpegFileName(name: string): string {
  const trimmed = (name || '').trim();
  const base = trimmed.replace(/\.(heic|heif)$/i, '') || 'photo';
  return /\.jpe?g$/i.test(base) ? base : `${base}.jpg`;
}

async function canvasToJpegFile(
  source: CanvasImageSource,
  width: number,
  height: number,
  originalName: string,
): Promise<File> {
  if (!width || !height) throw new Error('Decoded image has no dimensions');
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(source, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
  );
  if (!blob) throw new Error('JPEG encode failed');
  return new File([blob], jpegFileName(originalName), {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });
}

async function convertNative(file: File): Promise<File> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      try {
        return await canvasToJpegFile(bitmap, bitmap.width, bitmap.height, file.name);
      } finally {
        bitmap.close();
      }
    } catch {
      /* fall through to <img> */
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Native image decode failed'));
      el.src = url;
    });
    return await canvasToJpegFile(img, img.naturalWidth, img.naturalHeight, file.name);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function convertWithHeic2Any(file: File): Promise<File> {
  const heic2any = (await import('heic2any')).default;
  const result = await heic2any({
    blob: file,
    toType: 'image/jpeg',
    quality: JPEG_QUALITY,
  });
  const blob = Array.isArray(result) ? result[0] : result;
  if (!(blob instanceof Blob)) throw new Error('HEIC conversion returned nothing');
  return new File([blob], jpegFileName(file.name), {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });
}

/** Convert one HEIC/HEIF file to JPEG; pass other image types through unchanged. */
export async function ensureJpegForUpload(file: File): Promise<File> {
  if (!isHeicLike(file)) return file;
  try {
    return await convertNative(file);
  } catch {
    try {
      return await convertWithHeic2Any(file);
    } catch {
      throw new Error(
        'Could not convert this HEIC photo to JPEG. Try “Duplicate as JPEG” in Photos, or screenshot again.',
      );
    }
  }
}

/** Convert any HEIC/HEIF picks in the list; JPEG/PNG/WebP pass through. */
export async function prepareImagesForUpload(files: File[]): Promise<File[]> {
  const out: File[] = [];
  for (const f of files) {
    out.push(await ensureJpegForUpload(f));
  }
  return out;
}
