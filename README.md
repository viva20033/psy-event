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
3. Создайте первого администратора вручную:

```sql
INSERT INTO profiles (access_code, full_name, role)
VALUES ('ADMIN001', 'Организатор', 'admin');
```

4. Скопируйте URL и anon key в `.env`

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
