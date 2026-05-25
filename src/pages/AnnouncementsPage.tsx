import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { PriorityBadge } from '@/components/ui/Badge';
import { useOfflineData } from '@/hooks/useOfflineData';

export function AnnouncementsPage() {
  const { announcements } = useOfflineData();

  return (
    <AppShell title="Объявления">
      <div className="space-y-3">
        {announcements.length === 0 ? (
          <p className="text-center text-slate-500 py-8">Объявлений пока нет</p>
        ) : (
          announcements.map((a) => (
            <Card key={a.id}>
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-primary-900">{a.title}</h3>
                <PriorityBadge priority={a.priority} />
              </div>
              <p className="mt-2 text-sm text-slate-700">{a.body}</p>
              <p className="mt-2 text-xs text-slate-500">
                {format(parseISO(a.published_at), 'd MMMM HH:mm', { locale: ru })}
              </p>
            </Card>
          ))
        )}
      </div>
    </AppShell>
  );
}
