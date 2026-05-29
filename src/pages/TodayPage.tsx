import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { differenceInSeconds, parseISO } from 'date-fns';
import { AppShell } from '@/components/layout/AppShell';
import { EventCard } from '@/components/ui/EventCard';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PriorityBadge } from '@/components/ui/Badge';
import { useOfflineData } from '@/hooks/useOfflineData';
import { useSession } from '@/stores/session';
import { ROLE_LABELS } from '@/types';
import {
  findCurrentDay,
  getCurrentAndNext,
  getTodayEvents,
  resolveActiveVenue,
} from '@/lib/utils/schedule';

function useCountdown(endsAt: string | null) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!endsAt) return;
    const tick = () => {
      const left = differenceInSeconds(parseISO(endsAt), new Date());
      setSeconds(Math.max(0, left));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt]);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function TodayPage() {
  const profile = useSession((s) => s.profile);
  const { eventDays, scheduleEvents, announcements, settings } = useOfflineData();

  const currentDay = useMemo(
    () => findCurrentDay(eventDays),
    [eventDays],
  );
  const todayEvents = useMemo(
    () => getTodayEvents(scheduleEvents, currentDay),
    [scheduleEvents, currentDay],
  );
  const { current, next } = useMemo(
    () => getCurrentAndNext(todayEvents),
    [todayEvents],
  );

  const urgent = announcements.filter((a) => a.priority === 'urgent');
  const countdown = useCountdown(current?.ends_at ?? null);

  if (!profile) return null;

  const currentVenue = current
    ? resolveActiveVenue(current, settings.rain_mode)
    : null;
  const nextVenue = next ? resolveActiveVenue(next, settings.rain_mode) : null;

  return (
    <AppShell title="Мой день">
      <div className="space-y-4">
        <Card>
          <p className="text-sm text-slate-500">Здравствуйте</p>
          <h2 className="text-xl font-bold text-primary-900">{profile.full_name}</h2>
          <p className="text-sm text-slate-600">{ROLE_LABELS[profile.role]}</p>
          {currentDay && (
            <p className="mt-2 text-sm font-medium text-primary-700">{currentDay.label}</p>
          )}
        </Card>

        {urgent.map((a) => (
          <Card key={a.id} className="border-red-200 bg-red-50">
            <PriorityBadge priority="urgent" />
            <h3 className="mt-1 font-semibold">{a.title}</h3>
            {a.image_url && (
              <img
                src={a.image_url}
                alt=""
                className="mt-2 w-full max-h-40 object-cover rounded-lg"
              />
            )}
            <p className="text-sm">{a.body}</p>
          </Card>
        ))}

        {settings.rain_mode && (
          <Card className="border-blue-200 bg-blue-50">
            <p className="font-medium text-blue-900">Дождевой режим включён</p>
            <p className="text-sm text-blue-800">Показаны резервные места</p>
          </Card>
        )}

        {current ? (
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-primary-800">Сейчас</h3>
              <span className="rounded-lg bg-primary-100 px-2 py-1 text-sm font-mono text-primary-800">
                {countdown}
              </span>
            </div>
            <EventCard event={current} venue={currentVenue} highlight />
          </section>
        ) : (
          <Card>
            <p className="text-slate-600">Сейчас нет активного события</p>
          </Card>
        )}

        {next && (
          <section className="space-y-2">
            <h3 className="font-semibold text-primary-800">Далее</h3>
            <EventCard event={next} venue={nextVenue} />
          </section>
        )}

        <Link to="/my-groups">
          <Button variant="secondary" fullWidth>
            Мои группы
          </Button>
        </Link>

        <Link to="/lost">
          <Button variant="ghost" fullWidth>
            Я потерялся
          </Button>
        </Link>
      </div>
    </AppShell>
  );
}
