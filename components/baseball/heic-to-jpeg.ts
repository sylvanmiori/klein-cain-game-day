/**
 * Convert HEIC/HEIF picks from iPhone Photos to JPEG before box-score upload.
 * Workers AI vision does not reliably accept image/heic — so we convert client-side.
 *
 * Strategy:
 * - On Apple Safari (where native HEIC decode can "succeed" with blank/odd JPEGs),
 *   prefer heic2any first, then native.
 * - Elsewhere: native first (Safari-off / Chrome often throws), then heic2any.
 * - Always validate JPEG magic, dimensions, and byte size before accepting.
 * - Downscale longest side to MAX_LONG_SIDE for Workers AI friendliness.
 */

const HEIC_MIME = /^(image\/heic|image\/heif)$/i;
const HEIC_EXT = /\.(heic|heif)$/i;
const JPEG_QUALITY = 0.92;
export const MIN_JPEG_DIMENSION = 200;
export const MIN_JPEG_BYTES = 2_000;
export const MAX_LONG_SIDE = 2000;

declare module 'heic2any' {
  type Heic2AnyOptions = {
    blob: Blob;
    toType?: string;
    quality?: number;
    multiple?: boolean;
  };
  export default function heic2any(options: Heic2AnyOptions): Promise<Blob | Blob[]>;
}

export function isHeicLike(file: { name?: string; type?: string }): boolean {
  const type = (file.type || '').trim();
  if (type !== '' && HEIC_MIME.test(type)) return true;
  // iOS sometimes sends an empty or generic type — trust the extension.
  if (HEIC_EXT.test(file.name || '')) return true;
  return false;
}

/** JPEG SOI marker: FF D8 FF */
export function hasJpegMagic(bytes: ArrayBuffer | ArrayBufferView): boolean {
  const u8 =
    bytes instanceof Uint8Array
      ? bytes
      : new Uint8Array(
          ArrayBuffer.isView(bytes)
            ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
            : bytes,
        );
  return u8.byteLength >= 3 && u8[0] === 0xff && u8[1] === 0xd8 && u8[2] === 0xff;
}

function jpegFileName(name: string): string {
  const trimmed = (name || '').trim();
  const base = trimmed.replace(/\.(heic|heif)$/i, '') || 'photo';
  return /\.jpe?g$/i.test(base) ? base : `${base}.jpg`;
}

function scaledSize(width: number, height: number): { width: number; height: number } {
  const long = Math.max(width, height);
  if (long <= MAX_LONG_SIDE) return { width, height };
  const scale = MAX_LONG_SIDE / long;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Apple Safari can decode HEIC via createImageBitmap but sometimes yields a
 * blank or color-wrong JPEG that still has valid magic/dimensions. Prefer
 * heic2any there; elsewhere native-first is faster when it works.
 */
export function preferHeic2AnyFirst(
  userAgent: string = typeof navigator !== 'undefined' ? navigator.userAgent : '',
): boolean {
  const ua = userAgent || '';
  const isSafari =
    /Safari/i.test(ua) && !/Chrome|CriOS|Chromium|Edg|EdgiOS|OPR|FxiOS|Firefox/i.test(ua);
  return isSafari;
}

async function canvasToJpegFile(
  source: CanvasImageSource,
  width: number,
  height: number,
  originalName: string,
): Promise<File> {
  if (!width || !height) throw new Error('Decoded image has no dimensions');
  const sized = scaledSize(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = sized.width;
  canvas.height = sized.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(source, 0, 0, sized.width, sized.height);
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

async function jpegPixelSize(file: File): Promise<{ width: number; height: number }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      try {
        return { width: bitmap.width, height: bitmap.height };
      } finally {
        bitmap.close();
      }
    } catch {
      /* fall through */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('JPEG dimension probe failed'));
      el.src = url;
    });
    return { width: img.naturalWidth, height: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Reject blank/odd convert output before upload. */
export async function assertValidJpegFile(file: File): Promise<void> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!hasJpegMagic(bytes)) {
    throw new Error(`Converted file is not a JPEG (magic=${bytes[0]?.toString(16)} ${bytes[1]?.toString(16)} ${bytes[2]?.toString(16)})`);
  }
  if (bytes.byteLength < MIN_JPEG_BYTES) {
    throw new Error(`Converted JPEG too small (${bytes.byteLength} bytes)`);
  }
  const { width, height } = await jpegPixelSize(file);
  if (width < MIN_JPEG_DIMENSION || height < MIN_JPEG_DIMENSION) {
    throw new Error(`Converted JPEG too small (${width}×${height})`);
  }
}

/** Re-encode through canvas when longest side exceeds MAX_LONG_SIDE. */
async function maybeDownscaleJpeg(file: File): Promise<File> {
  const { width, height } = await jpegPixelSize(file);
  if (Math.max(width, height) <= MAX_LONG_SIDE) return file;
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    try {
      return await canvasToJpegFile(bitmap, bitmap.width, bitmap.height, file.name);
    } finally {
      bitmap.close();
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Downscale decode failed'));
      el.src = url;
    });
    return await canvasToJpegFile(img, img.naturalWidth, img.naturalHeight, file.name);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function finalizeConvertedJpeg(file: File): Promise<File> {
  await assertValidJpegFile(file);
  const scaled = await maybeDownscaleJpeg(file);
  if (scaled !== file) await assertValidJpegFile(scaled);
  return scaled;
}

/** Convert one HEIC/HEIF file to JPEG; pass other image types through unchanged. */
export async function ensureJpegForUpload(file: File): Promise<File> {
  if (!isHeicLike(file)) return file;

  const converters: Array<(f: File) => Promise<File>> = preferHeic2AnyFirst()
    ? [convertWithHeic2Any, convertNative]
    : [convertNative, convertWithHeic2Any];

  let lastErr: unknown;
  for (const convert of converters) {
    try {
      const jpeg = await convert(file);
      return await finalizeConvertedJpeg(jpeg);
    } catch (err) {
      lastErr = err;
    }
  }

  const detail = lastErr instanceof Error ? lastErr.message : lastErr != null ? JSON.stringify(lastErr) : '';
  throw new Error(
    `Could not convert this HEIC photo to JPEG${detail ? ` (${detail})` : ''}. Try “Duplicate as JPEG” in Photos, or screenshot again.`,
  );
}

/** Convert any HEIC/HEIF picks in the list; JPEG/PNG/WebP pass through. */
export async function prepareImagesForUpload(files: File[]): Promise<File[]> {
  const out: File[] = [];
  for (const f of files) {
    out.push(await ensureJpegForUpload(f));
  }
  return out;
}
