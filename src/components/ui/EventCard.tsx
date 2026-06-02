import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Card } from '@/components/ui/Card';
import { ExpandableBlock } from '@/components/ui/ExpandableBlock';
import type { ScheduleEvent, Venue } from '@/types';
import { cn } from '@/lib/utils/cn';

interface EventCardProps {
  event: ScheduleEvent;
  venue: Venue | null;
  highlight?: boolean;
  /** Локация по нажатию (для списка расписания) */
  collapsibleVenue?: boolean;
}

function VenueDetails({ venue }: { venue: Venue }) {
  return (
    <div className="space-y-2 rounded-xl bg-slate-50 border border-slate-100 p-3">
      {venue.landmark && (
        <p className="text-sm text-slate-700">
          <span className="font-medium text-slate-800">Ориентир:</span> {venue.landmark}
        </p>
      )}
      {venue.route_hint && (
        <p className="text-sm text-slate-700">
          <span className="font-medium text-slate-800">Как пройти:</span> {venue.route_hint}
        </p>
      )}
      {venue.description && <p className="text-sm text-slate-700">{venue.description}</p>}
      {venue.photo_url && (
        <img
          src={venue.photo_url}
          alt={venue.name}
          className="w-full rounded-lg object-cover max-h-48"
          loading="lazy"
        />
      )}
    </div>
  );
}

export function EventCard({ event, venue, highlight, collapsibleVenue }: EventCardProps) {
  const [venueOpen, setVenueOpen] = useState(false);
  const start = parseISO(event.starts_at);
  const end = parseISO(event.ends_at);

  return (
    <Card className={cn(highlight && 'ring-2 ring-primary-500 border-primary-200')}>
      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold text-primary-900">{event.title}</h3>
        <p className="text-sm text-slate-600">
          {format(start, 'HH:mm', { locale: ru })} – {format(end, 'HH:mm', { locale: ru })}
        </p>
        {venue && collapsibleVenue ? (
          <ExpandableBlock
            open={venueOpen}
            onToggle={() => setVenueOpen((o) => !o)}
            label={
              <span className="text-sm font-medium text-primary-800">
                Место: {venue.name}
              </span>
            }
            headerClassName="rounded-lg border border-slate-200 bg-white px-3 py-2.5 active:bg-slate-50"
          >
            <VenueDetails venue={venue} />
          </ExpandableBlock>
        ) : (
          venue && (
            <>
              <div className="space-y-1">
                <p className="font-medium text-primary-800">{venue.name}</p>
                {venue.landmark && (
                  <p className="text-sm text-slate-600">Ориентир: {venue.landmark}</p>
                )}
              </div>
              {venue.route_hint && (
                <p className="text-sm text-slate-600">Как пройти: {venue.route_hint}</p>
              )}
              {venue.photo_url && (
                <img
                  src={venue.photo_url}
                  alt={venue.name}
                  className="w-full rounded-xl object-cover max-h-48"
                  loading="lazy"
                />
              )}
            </>
          )
        )}
        {event.facilitator && (
          <p className="text-sm text-slate-600">Ведущий: {event.facilitator.full_name}</p>
        )}
        {event.description && (
          <p className="text-sm text-slate-700">{event.description}</p>
        )}
      </div>
    </Card>
  );
}
