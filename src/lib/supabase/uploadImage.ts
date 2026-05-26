import { supabase } from '@/lib/supabase/client';

const MAX_BYTES = 5 * 1024 * 1024;
const COMPRESS_IF_LARGER = 900 * 1024;
const MAX_DIMENSION = 1920;

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

function extForFile(file: File): string {
  const fromMime = MIME_EXT[file.type];
  if (fromMime) return fromMime;
  const match = file.name.match(/\.(\w+)$/i);
  return match ? match[1].toLowerCase() : 'jpg';
}

async function compressImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') {
    return file;
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', 0.85);
  });
  return blob ?? file;
}

async function prepareUploadBlob(file: File): Promise<{ blob: Blob; contentType: string; ext: string }> {
  if (file.size > MAX_BYTES) {
    throw new Error('Фото не больше 5 МБ. Выберите файл меньше или сожмите его.');
  }
  if (!file.type.startsWith('image/')) {
    throw new Error('Нужен файл изображения (JPEG, PNG, WebP).');
  }

  let blob: Blob = file;
  let contentType = file.type;
  let ext = extForFile(file);

  if (file.size > COMPRESS_IF_LARGER && file.type !== 'image/gif') {
    blob = await compressImage(file);
    contentType = 'image/jpeg';
    ext = 'jpg';
  }

  if (blob.size > MAX_BYTES) {
    throw new Error('После сжатия фото всё ещё больше 5 МБ. Попробуйте другое изображение.');
  }

  return { blob, contentType, ext };
}

export async function uploadImage(
  bucket: string,
  pathPrefix: string,
  file: File,
  migrationHint: string,
): Promise<string> {
  const { blob, contentType, ext } = await prepareUploadBlob(file);
  const safePrefix = pathPrefix.replace(/[^a-z0-9/_-]+/gi, '-').replace(/\/+/g, '/');
  const path = `${safePrefix}.${ext}`;

  const { error } = await supabase.storage.from(bucket).upload(path, blob, {
    contentType,
    cacheControl: '31536000',
    upsert: false,
  });

  if (error) {
    if (error.message.includes('Bucket not found')) {
      throw new Error(`Хранилище не настроено. Выполните в Supabase SQL: ${migrationHint}`);
    }
    if (error.message.includes('policy') || error.message.includes('row-level')) {
      throw new Error('Нет прав на загрузку. Войдите как организатор или админ.');
    }
    throw new Error(error.message);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
