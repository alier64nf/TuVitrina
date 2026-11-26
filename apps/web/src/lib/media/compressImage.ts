export interface CompressedImageResult {
  blob: Blob;
  mimeType: 'image/webp' | 'image/jpeg';
  sizeBytes: number;
  width: number;
  height: number;
}

const MAX_DIMENSION = 1280;
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

export async function compressImageToWebP(file: File): Promise<CompressedImageResult> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('No se pudo inicializar el procesador de imágenes del navegador.');
  }

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const encode = (mime: 'image/webp' | 'image/jpeg', quality: number) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, quality));

  let mimeType: 'image/webp' | 'image/jpeg' = 'image/webp';
  let blob = await encode('image/webp', 0.82);

  if (!blob || blob.type !== 'image/webp') {
    mimeType = 'image/jpeg';
    blob = await encode('image/jpeg', 0.82);
  }

  for (const quality of [0.7, 0.56, 0.42]) {
    if (blob && blob.size <= MAX_UPLOAD_BYTES) break;
    blob = await encode(mimeType, quality);
  }

  if (!blob) {
    throw new Error('No se pudo comprimir la imagen seleccionada.');
  }
  if (blob.size > MAX_UPLOAD_BYTES) {
    throw new Error('Incluso comprimida, la imagen supera los 2 MB. Elige una foto más liviana.');
  }

  return {
    blob,
    mimeType,
    sizeBytes: blob.size,
    width,
    height,
  };
}

export function uploadToSignedUrl(
  signedUrl: string,
  blob: Blob,
  mimeType: string,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', signedUrl, true);
    xhr.setRequestHeader('Content-Type', mimeType);

    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable && evt.total > 0) {
        onProgress(Math.min(100, Math.round((evt.loaded / evt.total) * 100)));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(new Error(`Error al subir la imagen (HTTP ${xhr.status}).`));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Falló la conexión durante la subida. Toca Reintentar.'));
    };

    xhr.send(blob);
  });
}
