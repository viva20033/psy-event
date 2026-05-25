# Структура файлов проекта

```
psy-event/
├── docs/
│   └── ARCHITECTURE.md          # Архитектура, принципы, offline, RLS
├── public/
│   └── favicon.svg
├── scripts/                     # (резерв для codegen)
├── src/
│   ├── app/
│   │   ├── providers.tsx        # QueryClient, Router, sync listener
│   │   └── router.tsx           # Маршруты + guards
│   ├── components/
│   │   ├── layout/
│   │   │   └── AppShell.tsx     # Header + bottom nav
│   │   └── ui/
│   │       ├── Badge.tsx
│   │       ├── Button.tsx
│   │       ├── Card.tsx
│   │       ├── EventCard.tsx
│   │       └── Input.tsx
│   ├── config/
│   │   ├── env.ts
│   │   └── feature-flags.ts     # Отключённые модули
│   ├── hooks/
│   │   ├── useOfflineData.ts    # Dexie live queries
│   │   └── useSyncOnReconnect.ts
│   ├── lib/
│   │   ├── offline/
│   │   │   ├── db.ts            # Dexie schema
│   │   │   └── sync.ts          # Pull + flush queue
│   │   ├── supabase/
│   │   │   └── client.ts        # Client + x-access-code
│   │   └── utils/
│   │       ├── cn.ts
│   │       └── schedule.ts      # Current/next event, rain venue
│   ├── pages/
│   │   ├── admin/
│   │   │   └── AdminPage.tsx
│   │   ├── AnnouncementsPage.tsx
│   │   ├── ConnectionsPage.tsx
│   │   ├── LoginPage.tsx
│   │   ├── LostPage.tsx
│   │   ├── SchedulePage.tsx
│   │   ├── TerritoryPage.tsx
│   │   └── TodayPage.tsx
│   ├── services/
│   │   ├── auth.ts
│   │   └── connections.ts       # Request/respond + offline queue
│   ├── stores/
│   │   └── session.ts           # Zustand + persist
│   ├── types/
│   │   └── index.ts
│   ├── App.tsx
│   ├── index.css
│   ├── main.tsx
│   └── vite-env.d.ts
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql
├── .env.example
├── eslint.config.js
├── index.html
├── package.json
├── postcss.config.js
├── README.md
├── tailwind.config.js
├── tsconfig.json
├── tsconfig.node.json
├── vercel.json
└── vite.config.ts                 # PWA (vite-plugin-pwa)
```

## Следующие шаги (не в v1, но заложено)

- `src/features/chat/` — при `featureFlags.chat = true`
- `supabase/functions/login-rate-limit/` — Edge Function
- Расширенная админка: CRUD расписания, мест, групп через UI
