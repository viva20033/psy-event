import { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { useOfflineData } from '@/hooks/useOfflineData';
import type { Venue } from '@/types';

export function TerritoryPage() {
  const { venues } = useOfflineData();
  const [selected, setSelected] = useState<Venue | null>(null);

  return (
    <AppShell title="Территория">
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
                onClick={() => setSelected(v)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-left active:bg-slate-50"
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
    </AppShell>
  );
}
