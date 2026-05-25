import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EventCard } from '@/components/ui/EventCard';
import { useOfflineData } from '@/hooks/useOfflineData';
import { env } from '@/config/env';
import {
  findCurrentDay,
  getCurrentAndNext,
  getTodayEvents,
  resolveActiveVenue,
} from '@/lib/utils/schedule';

export function LostPage() {
  const { eventDays, scheduleEvents, settings, venues } = useOfflineData();

  const currentDay = useMemo(() => findCurrentDay(eventDays), [eventDays]);
  const todayEvents = useMemo(
    () => getTodayEvents(scheduleEvents, currentDay),
    [scheduleEvents, currentDay],
  );
  const { current, next } = useMemo(
    () => getCurrentAndNext(todayEvents),
    [todayEvents],
  );

  const target = current ?? next;
  const venue = target ? resolveActiveVenue(target, settings.rain_mode) : null;
  const backupVenue = target?.backup_venue_id
    ? venues.find((v) => v.id === target.backup_venue_id) ?? null
    : null;

  const contact = settings.organizer_contact || env.organizerPhone;

  return (
    <AppShell title="Я потерялся">
      <div className="space-y-4">
        {target ? (
          <>
            <Card className="bg-primary-50 border-primary-200">
              <h2 className="text-lg font-bold text-primary-900">Куда идти</h2>
              <p className="mt-1 text-primary-800">{target.title}</p>
              {venue && <p className="mt-2 font-medium">{venue.name}</p>}
            </Card>
            <EventCard event={target} venue={venue} highlight />
            {settings.rain_mode && backupVenue && (
              <Card>
                <p className="text-sm font-medium text-blue-900">Резерв при дожде</p>
                <p>{backupVenue.name}</p>
                {backupVenue.route_hint && (
                  <p className="text-sm text-slate-600 mt-1">{backupVenue.route_hint}</p>
                )}
              </Card>
            )}
          </>
        ) : (
          <Card>
            <p>Обратитесь к организатору — сейчас нет ближайшего события в расписании.</p>
          </Card>
        )}

        <Card>
          <p className="text-sm font-medium text-slate-700">Контакт организатора</p>
          <a href={`tel:${contact.replace(/\s/g, '')}`} className="text-lg text-primary-700 font-semibold">
            {contact}
          </a>
        </Card>

        <Link to="/">
          <Button fullWidth>На главную</Button>
        </Link>
      </div>
    </AppShell>
  );
}
