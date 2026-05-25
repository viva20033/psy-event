# Архитектура PWA «Черноморский гештальт-интенсив МГИ»

## Принципы

1. **Ориентация, не управление** — приложение показывает «куда идти», не распределяет людей.
2. **Подтверждение выборов** — связи фиксируются двусторонним подтверждением.
3. **Offline-first** — критичные данные в IndexedDB; сеть для синхронизации.
4. **Модульность** — отключённые модули в `feature-flags.ts`, без мёртвого кода в UI.
5. **Минимум PII** — только имя, роль, связи, расписание.

## Стек

| Слой | Технология |
|------|------------|
| UI | React 18, TypeScript, Tailwind |
| Сборка | Vite |
| PWA | vite-plugin-pwa (Workbox) |
| API/DB | Supabase (PostgreSQL + Storage) |
| Состояние | Zustand (сессия) + TanStack Query (сервер) |
| Офлайн | Dexie (IndexedDB) |
| Хостинг | Vercel |

## Авторизация

Без SMS/email/OAuth:

1. Организатор создаёт участника → генерируется `access_code`.
2. Участник вводит код (или сканирует QR с URL `/?code=XXX`).
3. RPC `login_with_code` проверяет код, возвращает профиль.
4. Клиент сохраняет `{ profileId, accessCode }` в `localStorage` + профиль в Dexie.
5. Каждый запрос к Supabase: заголовок `x-access-code` для RLS.

RLS: политики читают `auth_access_code()` из заголовка и сопоставляют с `profiles.access_code`.

## Слои приложения

```
┌─────────────────────────────────────────┐
│  Pages (routes)                         │
├─────────────────────────────────────────┤
│  Features (today, schedule, …)          │
├─────────────────────────────────────────┤
│  Components (ui, layout)                │
├─────────────────────────────────────────┤
│  Services (api, sync, schedule-resolver)│
├─────────────────────────────────────────┤
│  Stores (session) + Dexie (offline DB)  │
├─────────────────────────────────────────┤
│  Supabase client                        │
└─────────────────────────────────────────┘
```

## Персональное расписание

`schedule_events` — все события интенсива.

`event_audience` — кому показывать событие:
- `role` (nullable) — роль
- `group_id` (nullable) — конкретная группа
- `all` — всем

Резолвер на клиенте (и в RPC `get_my_schedule`):
1. События с `audience = all`
2. События с `role = user.role`
3. События с `group_id` в группах пользователя
4. События связанных сущностей (терапевт, супервизор, процесс-группа)

## Связи (connections)

Типы: `client_therapist`, `therapist_supervisor`, `process_group`.

Статусы: `pending`, `confirmed`, `rejected`.

Поток:
1. Клиент выбирает терапевта → `pending`, requester = клиент.
2. Терапевт видит запрос → `confirmed` / `rejected`.
3. Офлайн: запись в `sync_queue` → при сети `push_sync_queue`.

## Дождевой режим

`event_settings.rain_mode = true` → UI и RPC отдают `backup_venue_id` вместо `venue_id`.

## Офлайн

| Данные | Хранение | Обновление |
|--------|----------|------------|
| Shell PWA | Service Worker | Workbox precache |
| Профиль | Dexie `profiles` | При логине |
| Расписание | Dexie `schedule` | Pull при сети |
| Места | Dexie `venues` | Pull |
| Объявления | Dexie `announcements` | Pull |
| Связи | Dexie `connections` | Pull + push queue |
| Очередь | Dexie `syncQueue` | Push при online |

Событие `online` → `SyncService.flush()`.

## Отключённые модули

Флаги в `src/config/feature-flags.ts`: `chat`, `gallery`, `workshops`, `networking`, `push`, `polls`, `materials`, `notes` — все `false`. Роуты не регистрируются.

## Безопасность

- RLS на всех таблицах.
- Админ-операции только для `role IN ('organizer', 'admin')`.
- `access_code` — 8 символов, криптостойкий random.
- Storage: фото мест только публичные URL.

## Масштабирование (будущее)

- Edge Functions для rate-limit логина.
- Realtime для срочных объявлений (сейчас polling).
- Push — флаг уже есть.
- Чат — отдельная схема `messages`, не смешивать с connections.
