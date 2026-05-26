import { useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/admin/FormField';
import { formatSaveError } from '@/hooks/useAdminFeedback';

interface ImageUploadFieldProps {
  label: string;
  hint: string;
  imageUrl: string;
  onChange: (url: string) => void;
  disabled?: boolean;
  uploadFile: (file: File) => Promise<string>;
  validateBeforeUpload?: () => string | null;
  alt?: string;
}

export function ImageUploadField({
  label,
  hint,
  imageUrl,
  onChange,
  disabled,
  uploadFile,
  validateBeforeUpload,
  alt = 'Изображение',
}: ImageUploadFieldProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showUrl, setShowUrl] = useState(false);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const validationError = validateBeforeUpload?.();
    if (validationError) {
      setUploadError(validationError);
      return;
    }

    setUploading(true);
    setUploadError(null);
    try {
      const url = await uploadFile(file);
      onChange(url);
    } catch (err) {
      setUploadError(formatSaveError(err));
    } finally {
      setUploading(false);
    }
  }

  return (
    <FormField label={label} hint={hint}>
      <div className="space-y-3">
        {imageUrl ? (
          <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
            <img src={imageUrl} alt={alt} className="w-full max-h-48 object-cover" />
            <Button
              type="button"
              size="sm"
              variant="danger"
              className="absolute top-2 right-2"
              disabled={disabled || uploading}
              onClick={() => onChange('')}
            >
              Убрать
            </Button>
          </div>
        ) : null}

        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/*"
          className="sr-only"
          disabled={disabled || uploading}
          onChange={onFileChange}
        />

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={disabled || uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? 'Загрузка…' : imageUrl ? 'Заменить' : 'Выбрать фото'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={disabled || uploading}
            onClick={() => setShowUrl((v) => !v)}
          >
            {showUrl ? 'Скрыть ссылку' : 'Вставить ссылку'}
          </Button>
        </div>

        {uploadError && (
          <p className="text-sm text-red-600" role="alert">
            {uploadError}
          </p>
        )}

        {showUrl && (
          <Input
            value={imageUrl}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://..."
            disabled={disabled || uploading}
          />
        )}
      </div>
    </FormField>
  );
}
