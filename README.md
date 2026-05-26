# МГИ Сочи — PWA для гештальт-интенсива

Production-ready PWA для ориентации участников на Черноморском гештальт-интенсиве МГИ (≈200 человек, 12 дней).

**Главный вопрос приложения:** «Куда мне сейчас идти?»

## Стек

- **Frontend:** React 18, Vite, TypeScript, Tailwind
- **Backend:** Supabase (PostgreSQL, Storage, RLS)
- **Offline:** Dexie (IndexedDB) + Service Worker (vite-plugin-pwa)
- **Deploy:** Vercel

## Быстрый старт

```bash
npm install
cp .env.example .env
# Заполните VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY
npm run dev
```

## Supabase

1. Создайте проект на [supabase.com](https://supabase.com)
2. В SQL Editor выполните `supabase/migrations/001_initial_schema.sql`
3. Фото мест: `supabase/migrations/003_venue_photos_storage.sql`
4. Объявления + push: `supabase/migrations/004_announcements_push.sql`
5. Защита от дублей связей: `supabase/migrations/005_connections_unique.sql`
6. Импорт расписания (19 июня — 1 июля 2026): `supabase/migrations/002_schedule_2026.sql`  
   Перед повторным запуском сделайте бэкап — скрипт удаляет все события в `schedule_events`.  
   Чтобы пересобрать SQL после правок: `npm run schedule:sql` (редактируйте `scripts/schedule-2026-data.mjs`).
7. Создайте первого администратора вручную:

```sql
INSERT INTO profiles (access_code, full_name, role)
VALUES ('ADMIN001', 'Организатор', 'admin');
```

8. Скопируйте URL и anon key в `.env`

### Push-уведомления об объявлениях

1. Сгенерируйте VAPID-ключи: `npm run vapid`
2. В `.env` и Vercel: `VITE_VAPID_PUBLIC_KEY` = публичный ключ
3. Задеплойте Edge Function и секреты в Supabase:

```bash
npx supabase functions deploy notify-announcement --no-verify-jwt
npx supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@example.com
```

4. Участники на экране «Объявления» нажимают «Включить уведомления» (нужен HTTPS и установленное PWA или Chrome/Android).

## Структура проекта

```
src/
├── app/           # router, providers
├── components/    # ui, layout
├── config/        # env, feature-flags
├── hooks/         # offline data, sync
├── lib/           # supabase, offline (dexie), utils
├── pages/         # экраны + admin/
├── services/      # auth, connections
├── stores/        # session (zustand)
└── types/
docs/ARCHITECTURE.md
supabase/migrations/
```

## Экраны

| Маршрут | Экран |
|---------|-------|
| `/` | Мой день |
| `/schedule` | Расписание |
| `/connections` | Мои связи |
| `/territory` | Территория |
| `/announcements` | Объявления |
| `/lost` | Я потерялся |
| `/admin` | Админка (organizer/admin) |
| `/login?code=XXX` | Вход по коду |

## Авторизация

- Организатор создаёт участников → генерируется `access_code` (8 символов)
- Участник вводит код или сканирует QR
- Сессия хранится локально, повторный вход не нужен
- Заголовок `x-access-code` для RLS

## Offline

Кэшируются: shell, расписание, места, объявления, связи, профиль.

Изменения связей офлайн → очередь `syncQueue` → синхронизация при `online`.

## Отключённые модули

В `src/config/feature-flags.ts`: chat, gallery, workshops, networking, push, polls, materials, notes — архитектурно зарезервированы, `false`.

## Иконка PWA

1. Положите исходник в `public/icons/source.png` (квадрат, от 512×512 px).
2. Сгенерируйте размеры: `npm run icons`
3. Закоммитьте `public/icons/*.png` и сделайте deploy на Vercel.
4. На телефоне переустановите ярлык (или удалите старый и добавьте снова), чтобы подтянулась новая иконка.

## Deploy (Vercel)

```bash
npm run build
```

Environment variables в Vercel: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_ORGANIZER_PHONE`.

## Этика данных

Хранятся только: имя, роль, связи, расписание, организационные данные.  
**Не хранятся:** терапевтические записи, диагнозы, жалобы.

## Дальнейшее развитие

- Realtime для срочных объявлений
- Расширенная админка (расписание, места, группы)
- Edge Function rate-limit для login
- Push-уведомления (флаг уже есть)

Подробнее: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
