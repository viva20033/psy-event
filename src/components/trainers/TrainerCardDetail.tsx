import type { IntensiveTrainer } from '@/types';

interface TrainerCardDetailProps {
  trainer: IntensiveTrainer;
  showGestaltLink?: boolean;
}

export function TrainerCardDetail({ trainer, showGestaltLink = true }: TrainerCardDetailProps) {
  return (
    <div className="space-y-3">
      {trainer.photo_url && (
        <img
          src={trainer.photo_url}
          alt={trainer.full_name}
          className="w-full max-h-72 object-cover rounded-xl"
        />
      )}
      <div>
        <h2 className="text-xl font-bold text-primary-900">{trainer.full_name}</h2>
        {trainer.status_line && (
          <p className="text-sm text-primary-700 mt-1">{trainer.status_line}</p>
        )}
        {(trainer.city || trainer.phone || trainer.email) && (
          <div className="mt-2 text-sm text-slate-600 space-y-1">
            {trainer.city && <p>{trainer.city}</p>}
            {trainer.phone && (
              <p>
                <a href={`tel:${trainer.phone.replace(/\s/g, '')}`} className="text-primary-600">
                  {trainer.phone}
                </a>
              </p>
            )}
            {trainer.email && (
              <p>
                <a href={`mailto:${trainer.email}`} className="text-primary-600 break-all">
                  {trainer.email}
                </a>
              </p>
            )}
          </div>
        )}
      </div>
      {trainer.bio && (
        <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{trainer.bio}</div>
      )}
      {trainer.specializations && (
        <div>
          <p className="text-sm font-medium text-slate-800 mb-1">Специализация</p>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{trainer.specializations}</p>
        </div>
      )}
      {showGestaltLink && trainer.gestalt_url && (
        <a
          href={trainer.gestalt_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary-600 font-medium inline-block"
        >
          Полная страница на gestalt.ru →
        </a>
      )}
    </div>
  );
}
