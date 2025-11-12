import { ImageFormat } from '../shared/types/Image';

/**
 * Magic bytes for image format detection
 * First few bytes of common image formats
 */
const MAGIC_BYTES: Record<string, number[]> = {
  jpeg: [0xff, 0xd8, 0xff],
  png: [0x89, 0x50, 0x4e, 0x47],
  gif: [0x47, 0x49, 0x46],
  bmp: [0x42, 0x4d],
  tiff_le: [0x49, 0x49, 0x2a, 0x00], // Little-endian TIFF
  tiff_be: [0x4d, 0x4d, 0x00, 0x2a], // Big-endian TIFF
  webp: [0x52, 0x49, 0x46, 0x46], // RIFF header (WebP uses WEBP signature after)
  psd: [0x38, 0x42, 0x50, 0x53], // 8BPS
};

/**
 * Detect image format from file extension
 */
export function detectFormatFromExtension(filename: string): ImageFormat {
  const ext = filename.toLowerCase().split('.').pop() || '';

  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return ImageFormat.JPEG;
    case 'png':
      return ImageFormat.PNG;
    case 'gif':
      return ImageFormat.GIF;
    case 'bmp':
      return ImageFormat.BMP;
    case 'tif':
    case 'tiff':
      return ImageFormat.TIFF;
    case 'webp':
      return ImageFormat.WEBP;
    case 'psd':
      return ImageFormat.PSD;
    case 'svg':
      return ImageFormat.SVG;
    default:
      return ImageFormat.UNKNOWN;
  }
}

/**
 * Detect image format from magic bytes (file header)
 */
export function detectFormatFromMagicBytes(buffer: Buffer): ImageFormat {
  if (buffer.length < 4) {
    return ImageFormat.UNKNOWN;
  }

  // JPEG
  if (
    buffer[0] === MAGIC_BYTES.jpeg[0] &&
    buffer[1] === MAGIC_BYTES.jpeg[1] &&
    buffer[2] === MAGIC_BYTES.jpeg[2]
  ) {
    return ImageFormat.JPEG;
  }

  // PNG
  if (
    buffer[0] === MAGIC_BYTES.png[0] &&
    buffer[1] === MAGIC_BYTES.png[1] &&
    buffer[2] === MAGIC_BYTES.png[2] &&
    buffer[3] === MAGIC_BYTES.png[3]
  ) {
    return ImageFormat.PNG;
  }

  // GIF
  if (
    buffer[0] === MAGIC_BYTES.gif[0] &&
    buffer[1] === MAGIC_BYTES.gif[1] &&
    buffer[2] === MAGIC_BYTES.gif[2]
  ) {
    return ImageFormat.GIF;
  }

  // BMP
  if (buffer[0] === MAGIC_BYTES.bmp[0] && buffer[1] === MAGIC_BYTES.bmp[1]) {
    return ImageFormat.BMP;
  }

  // TIFF (little-endian or big-endian)
  if (
    (buffer[0] === MAGIC_BYTES.tiff_le[0] &&
      buffer[1] === MAGIC_BYTES.tiff_le[1] &&
      buffer[2] === MAGIC_BYTES.tiff_le[2] &&
      buffer[3] === MAGIC_BYTES.tiff_le[3]) ||
    (buffer[0] === MAGIC_BYTES.tiff_be[0] &&
      buffer[1] === MAGIC_BYTES.tiff_be[1] &&
      buffer[2] === MAGIC_BYTES.tiff_be[2] &&
      buffer[3] === MAGIC_BYTES.tiff_be[3])
  ) {
    return ImageFormat.TIFF;
  }

  // WebP (RIFF header + WEBP signature at offset 8)
  if (
    buffer[0] === MAGIC_BYTES.webp[0] &&
    buffer[1] === MAGIC_BYTES.webp[1] &&
    buffer[2] === MAGIC_BYTES.webp[2] &&
    buffer[3] === MAGIC_BYTES.webp[3] &&
    buffer.length >= 12
  ) {
    const webpSignature = buffer.toString('ascii', 8, 12);
    if (webpSignature === 'WEBP') {
      return ImageFormat.WEBP;
    }
  }

  // PSD
  if (
    buffer[0] === MAGIC_BYTES.psd[0] &&
    buffer[1] === MAGIC_BYTES.psd[1] &&
    buffer[2] === MAGIC_BYTES.psd[2] &&
    buffer[3] === MAGIC_BYTES.psd[3]
  ) {
    return ImageFormat.PSD;
  }

  return ImageFormat.UNKNOWN;
}

/**
 * Check if a filename represents a supported image format
 */
export function isSupportedImageFormat(filename: string): boolean {
  const format = detectFormatFromExtension(filename);
  return format !== ImageFormat.UNKNOWN;
}

/**
 * Get file extension for an image format
 */
export function getExtensionForFormat(format: ImageFormat): string {
  switch (format) {
    case ImageFormat.JPEG:
      return 'jpg';
    case ImageFormat.PNG:
      return 'png';
    case ImageFormat.GIF:
      return 'gif';
    case ImageFormat.BMP:
      return 'bmp';
    case ImageFormat.TIFF:
      return 'tiff';
    case ImageFormat.WEBP:
      return 'webp';
    case ImageFormat.PSD:
      return 'psd';
    case ImageFormat.SVG:
      return 'svg';
    default:
      return 'unknown';
  }
}

/**
 * Check if an image is likely a double-page spread
 * Based on aspect ratio: width / height > 1.5
 */
export function isDoublePageSpread(width: number, height: number): boolean {
  return width / height > 1.5;
}
