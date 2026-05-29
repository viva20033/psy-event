import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { TrainerCardDetail } from '@/components/trainers/TrainerCardDetail';
import { useOfflineData } from '@/hooks/useOfflineData';
import { cn } from '@/lib/utils/cn';
import type { IntensiveTrainer, Venue } from '@/types';

type InfoTab = 'venues' | 'trainers';

function VenuesTab({
  venues,
  selected,
  onSelect,
}: {
  venues: Venue[];
  selected: Venue | null;
  onSelect: (v: Venue | null) => void;
}) {
  return (
    <div className="space-y-4">
      <Card className="bg-primary-50 border-primary-100">
        <p className="text-sm text-primary-800">
          Схема территории санатория. Выберите место — увидите фото и маршрут словами.
        </p>
      </Card>
      <ul className="space-y-2">
        {venues.map((v) => (
          <li key={v.id}>
            <button
              type="button"
              onClick={() => onSelect(selected?.id === v.id ? null : v)}
              className={cn(
                'w-full rounded-xl border px-4 py-3 text-left active:bg-slate-50',
                selected?.id === v.id
                  ? 'border-primary-300 bg-primary-50'
                  : 'border-slate-200 bg-white',
              )}
            >
              <span className="font-medium text-primary-900">{v.name}</span>
            </button>
          </li>
        ))}
      </ul>
      {selected && (
        <Card className="space-y-3">
          <h3 className="text-lg font-semibold">{selected.name}</h3>
          {selected.photo_url && (
            <img
              src={selected.photo_url}
              alt={selected.name}
              className="w-full rounded-xl object-cover max-h-56"
            />
          )}
          {selected.description && (
            <p className="text-sm text-slate-700">{selected.description}</p>
          )}
          {selected.landmark && (
            <p className="text-sm">
              <span className="font-medium">Ориентир:</span> {selected.landmark}
            </p>
          )}
          {selected.route_hint && (
            <p className="text-sm">
              <span className="font-medium">Как пройти:</span> {selected.route_hint}
            </p>
          )}
        </Card>
      )}
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
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
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
    setSelectedVenue(null);
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
        <VenuesTab venues={venues} selected={selectedVenue} onSelect={setSelectedVenue} />
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
