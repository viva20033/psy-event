import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { AppShell } from '@/components/layout/AppShell';
import { EventCard } from '@/components/ui/EventCard';
import { useOfflineData } from '@/hooks/useOfflineData';
import { resolveActiveVenue } from '@/lib/utils/schedule';
import { cn } from '@/lib/utils/cn';

export function SchedulePage() {
  const { eventDays, scheduleEvents, settings } = useOfflineData();
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);

  const activeDayId = selectedDayId ?? eventDays[0]?.id ?? null;

  const dayEvents = useMemo(() => {
    return scheduleEvents
      .filter((e) => e.event_day_id === activeDayId)
      .sort((a, b) => parseISO(a.starts_at).getTime() - parseISO(b.starts_at).getTime());
  }, [scheduleEvents, activeDayId]);

  return (
    <AppShell title="Моё расписание">
      <div className="space-y-4">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {eventDays.map((day) => (
            <button
              key={day.id}
              type="button"
              onClick={() => setSelectedDayId(day.id)}
              className={cn(
                'shrink-0 rounded-full px-3 py-2 text-sm font-medium',
                activeDayId === day.id
                  ? 'bg-primary-700 text-white'
                  : 'bg-white text-slate-600 border border-slate-200',
              )}
            >
              {day.label}
            </button>
          ))}
        </div>

        {dayEvents.length === 0 ? (
          <p className="text-center text-slate-500 py-8">Нет событий на этот день</p>
        ) : (
          dayEvents.map((event) => (
            <div key={event.id}>
              <p className="mb-1 text-xs text-slate-500">
                {format(parseISO(event.starts_at), 'd MMMM, HH:mm', { locale: ru })}
              </p>
              <EventCard
                event={event}
                venue={resolveActiveVenue(event, settings.rain_mode)}
              />
            </div>
          ))
        )}
      </div>
    </AppShell>
  );
}
