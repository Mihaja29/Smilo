const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);
const MAX_RAW_FILE_BYTES = 10 * 1024 * 1024;
const MAX_DIMENSION_PX = 1024;
const MAX_DATA_URL_CHARS = 750000;

export function isSafeImageDataUrl(value?: string): boolean {
  if (!value) return false;
  return /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/.test(value.trim());
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error("Impossible de lire l'image."));
      }
    };
    reader.onerror = () => reject(new Error("Impossible de lire l'image."));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Fichier image invalide ou corrompu."));
    img.src = src;
  });
}

// VALIDATION ET OPTIMISATION DES IMAGES IMPORTEES DANS LE CHAT
export async function prepareDiscussionImage(file: File): Promise<string> {
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error('Formats acceptés : PNG, JPG ou WEBP uniquement.');
  }
  if (file.size > MAX_RAW_FILE_BYTES) {
    throw new Error("L'image est trop lourde (maximum 10 Mo).");
  }

  const rawDataUrl = await readFileAsDataUrl(file);
  const img = await loadImageElement(rawDataUrl);

  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;
  if (!width || !height) {
    throw new Error("Dimensions d'image invalides.");
  }

  if (
    width <= MAX_DIMENSION_PX &&
    height <= MAX_DIMENSION_PX &&
    rawDataUrl.length <= MAX_DATA_URL_CHARS &&
    isSafeImageDataUrl(rawDataUrl)
  ) {
    return rawDataUrl;
  }

  const scale = Math.min(1, MAX_DIMENSION_PX / Math.max(width, height));
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error("Impossible de traiter l'image.");
  }
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  const outputMime = file.type === 'image/png' ? 'image/jpeg' : file.type;
  let quality = 0.84;
  let result = canvas.toDataURL(outputMime, quality);

  while (result.length > MAX_DATA_URL_CHARS && quality > 0.4) {
    quality -= 0.12;
    result = canvas.toDataURL('image/jpeg', quality);
  }

  if (!isSafeImageDataUrl(result) || result.length > MAX_DATA_URL_CHARS) {
    throw new Error("L'image reste trop volumineuse après compression.");
  }

  return result;
}
