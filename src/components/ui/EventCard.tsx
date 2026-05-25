import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Card } from '@/components/ui/Card';
import type { ScheduleEvent, Venue } from '@/types';
import { cn } from '@/lib/utils/cn';

interface EventCardProps {
  event: ScheduleEvent;
  venue: Venue | null;
  highlight?: boolean;
}

export function EventCard({ event, venue, highlight }: EventCardProps) {
  const start = parseISO(event.starts_at);
  const end = parseISO(event.ends_at);

  return (
    <Card className={cn(highlight && 'ring-2 ring-primary-500 border-primary-200')}>
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-primary-900">{event.title}</h3>
        <p className="text-sm text-slate-600">
          {format(start, 'HH:mm', { locale: ru })} – {format(end, 'HH:mm', { locale: ru })}
        </p>
        {venue && (
          <div className="space-y-1">
            <p className="font-medium text-primary-800">{venue.name}</p>
            {venue.landmark && (
              <p className="text-sm text-slate-600">Ориентир: {venue.landmark}</p>
            )}
          </div>
        )}
        {event.facilitator && (
          <p className="text-sm text-slate-600">Ведущий: {event.facilitator.full_name}</p>
        )}
        {event.description && (
          <p className="text-sm text-slate-700">{event.description}</p>
        )}
        {venue?.photo_url && (
          <img
            src={venue.photo_url}
            alt={venue.name}
            className="mt-2 w-full rounded-xl object-cover max-h-48"
            loading="lazy"
          />
        )}
      </div>
    </Card>
  );
}
