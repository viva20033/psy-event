import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { TrainerCardDetail } from '@/components/trainers/TrainerCardDetail';
import { useOfflineData } from '@/hooks/useOfflineData';
import { cn } from '@/lib/utils/cn';
import type { IntensiveTrainer, Venue } from '@/types';

type InfoTab = 'venues' | 'trainers';

function VenueDetails({ venue }: { venue: Venue }) {
  return (
    <div className="space-y-3 border-t border-slate-100 pt-3">
      {venue.photo_url && (
        <img
          src={venue.photo_url}
          alt={venue.name}
          className="w-full rounded-xl object-cover max-h-56"
        />
      )}
      {venue.description && <p className="text-sm text-slate-700">{venue.description}</p>}
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
    </div>
  );
}

function VenuesTab({
  venues,
  expandedId,
  onToggle,
}: {
  venues: Venue[];
  expandedId: string | null;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Card className="bg-primary-50 border-primary-100">
        <p className="text-sm text-primary-800">
          Нажмите на место — описание раскроется прямо в списке.
        </p>
      </Card>
      <ul className="flex flex-col gap-2">
        {venues.map((v) => {
          const open = expandedId === v.id;
          return (
            <li
              key={v.id}
              className={cn(
                'rounded-xl border bg-white overflow-hidden transition-colors',
                open ? 'border-primary-300 shadow-sm' : 'border-slate-200',
              )}
            >
              <button
                type="button"
                onClick={() => onToggle(v.id)}
                aria-expanded={open}
                className={cn(
                  'flex w-full items-center justify-between gap-2 px-4 py-3 text-left active:bg-slate-50',
                  open && 'bg-primary-50',
                )}
              >
                <span className="font-medium text-primary-900">{v.name}</span>
                <span
                  className={cn(
                    'text-slate-400 text-lg leading-none transition-transform',
                    open && 'rotate-180',
                  )}
                  aria-hidden
                >
                  ▾
                </span>
              </button>
              {open && (
                <div className="px-4 pb-4">
                  <VenueDetails venue={v} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TrainersTab({
  trainers,
  selectedId,
  onSelectId,
}: {
  trainers: IntensiveTrainer[];
  selectedId: string | null;
  onSelectId: (id: string | null) => void;
}) {
  const selected = trainers.find((t) => t.id === selectedId) ?? null;
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return trainers;
    return trainers.filter((t) => t.full_name.toLowerCase().includes(q));
  }, [trainers, query]);

  if (selected) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => onSelectId(null)}
          className="text-sm text-primary-600 font-medium"
        >
          ← К списку тренеров
        </button>
        <Card>
          <TrainerCardDetail trainer={selected} />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="bg-primary-50 border-primary-100">
        <p className="text-sm text-primary-800">
          Тренеры и ведущие интенсива. Нажмите на имя — откроется карточка с фото и описанием.
        </p>
      </Card>
      <input
        type="search"
        placeholder="Поиск по фамилии…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
      />
      {filtered.length === 0 ? (
        <Card className="text-sm text-slate-600 text-center py-6">
          {trainers.length === 0
            ? 'Список тренеров пока пуст. Организаторы добавят карточки в админке.'
            : 'Никого не найдено'}
        </Card>
      ) : (
        <ul className="space-y-2">
          {filtered.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onSelectId(t.id)}
                className="w-full flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left active:bg-slate-50"
              >
                {t.photo_url ? (
                  <img
                    src={t.photo_url}
                    alt=""
                    className="h-12 w-12 rounded-lg object-cover shrink-0"
                  />
                ) : (
                  <span className="h-12 w-12 rounded-lg bg-primary-100 text-primary-700 flex items-center justify-center text-lg shrink-0">
                    {t.full_name.charAt(0)}
                  </span>
                )}
                <span className="font-medium text-primary-900 text-sm">{t.full_name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function InformationPage() {
  const { venues, intensiveTrainers } = useOfflineData();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const trainerParam = searchParams.get('trainer');

  const [tab, setTab] = useState<InfoTab>(
    tabParam === 'trainers' || trainerParam ? 'trainers' : 'venues',
  );
  const [expandedVenueId, setExpandedVenueId] = useState<string | null>(null);
  const [selectedTrainerId, setSelectedTrainerId] = useState<string | null>(trainerParam);

  useEffect(() => {
    if (trainerParam) {
      setTab('trainers');
      setSelectedTrainerId(trainerParam);
    } else if (tabParam === 'trainers') {
      setTab('trainers');
    }
  }, [trainerParam, tabParam]);

  function switchTab(next: InfoTab) {
    setTab(next);
    setExpandedVenueId(null);
    if (next === 'venues') {
      setSelectedTrainerId(null);
      setSearchParams({});
    } else {
      setSearchParams({ tab: 'trainers' });
    }
  }

  function selectTrainer(id: string | null) {
    setSelectedTrainerId(id);
    if (id) setSearchParams({ tab: 'trainers', trainer: id });
    else setSearchParams({ tab: 'trainers' });
  }

  return (
    <AppShell title="Информация">
      <div className="flex rounded-xl border border-slate-200 bg-white p-1 mb-4">
        <button
          type="button"
          onClick={() => switchTab('venues')}
          className={cn(
            'flex-1 rounded-lg py-2 text-sm font-medium transition-colors',
            tab === 'venues' ? 'bg-primary-600 text-white' : 'text-slate-600',
          )}
        >
          Места
        </button>
        <button
          type="button"
          onClick={() => switchTab('trainers')}
          className={cn(
            'flex-1 rounded-lg py-2 text-sm font-medium transition-colors',
            tab === 'trainers' ? 'bg-primary-600 text-white' : 'text-slate-600',
          )}
        >
          Тренеры
        </button>
      </div>

      {tab === 'venues' ? (
        <VenuesTab
          venues={venues}
          expandedId={expandedVenueId}
          onToggle={(id) => setExpandedVenueId((prev) => (prev === id ? null : id))}
        />
      ) : (
        <TrainersTab
          trainers={intensiveTrainers}
          selectedId={selectedTrainerId}
          onSelectId={selectTrainer}
        />
      )}
    </AppShell>
  );
}
