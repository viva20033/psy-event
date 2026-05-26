import { ImageUploadField } from '@/components/admin/ImageUploadField';
import { uploadVenuePhoto } from '@/lib/supabase/venuePhoto';

interface VenuePhotoFieldProps {
  photoUrl: string;
  venueSlug: string;
  onChange: (url: string) => void;
  disabled?: boolean;
}

export function VenuePhotoField({
  photoUrl,
  venueSlug,
  onChange,
  disabled,
}: VenuePhotoFieldProps) {
  return (
    <ImageUploadField
      label="Фото места"
      hint="С телефона или компьютера. До 5 МБ, JPEG/PNG/WebP."
      imageUrl={photoUrl}
      onChange={onChange}
      disabled={disabled}
      alt="Фото места"
      uploadFile={(file) => uploadVenuePhoto(file, venueSlug)}
      validateBeforeUpload={() =>
        venueSlug.trim() ? null : 'Сначала введите название места'
      }
    />
  );
}
