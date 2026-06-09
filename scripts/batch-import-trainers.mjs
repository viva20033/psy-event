#!/usr/bin/env node
/**
 * Массовое создание тренеров интенсива + импорт карточек с gestalt.ru
 *
 * Перед запуском примените миграцию 010_trainer_role.sql
 *
 * Переменные окружения:
 *   SUPABASE_URL              — https://api.intensiv-mgi.ru (или cloud URL)
 *   SUPABASE_SERVICE_ROLE_KEY — service role key
 *   ADMIN_ACCESS_CODE         — код входа организатора/админа (для RPC и edge function)
 *
 *   node scripts/batch-import-trainers.mjs
 *   node scripts/batch-import-trainers.mjs --dry-run
 *   node scripts/batch-import-trainers.mjs --refresh   # повторный импорт (в т.ч. фото в storage)
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TRAINERS_TEAM } from './intensive-trainers-team.mjs';
import { fetchAndParseGestaltAuthor } from './lib/parse-gestalt-author.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadDotEnv() {
  try {
    const raw = readFileSync(resolve(root, '.env'), 'utf8');
    for (const line of raw.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq < 0) continue;
      const key = t.slice(0, eq).trim();
      const val = t.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    /* no .env */
  }
}

function normalizeUrl(raw) {
  const u = new URL(raw.trim());
  if (!u.pathname.endsWith('/')) u.pathname += '/';
  return u.toString();
}

function slugFromUrl(url) {
  return new URL(url).pathname.split('/').filter(Boolean).pop() ?? '';
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

loadDotEnv();

const supabaseUrl = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '').replace(
  /\/$/,
  '',
);
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminCode = process.env.ADMIN_ACCESS_CODE;
const dryRun = process.argv.includes('--dry-run');
const refreshOnly = process.argv.includes('--refresh');

if (!supabaseUrl || !serviceKey || !adminCode) {
  console.error(
    'Нужны SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY и ADMIN_ACCESS_CODE.\n' +
      'Пример:\n' +
      '  export SUPABASE_URL="https://api.intensiv-mgi.ru"\n' +
      '  export SUPABASE_SERVICE_ROLE_KEY="..."\n' +
      '  export ADMIN_ACCESS_CODE="..."\n' +
      '  node scripts/batch-import-trainers.mjs',
  );
  process.exit(1);
}

const restBase = `${supabaseUrl}/rest/v1`;

function restHeaders(extra = {}) {
  return {
    Authorization: `Bearer ${serviceKey}`,
    apikey: serviceKey,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function parseResponse(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function rpc(name, params) {
  const res = await fetch(`${restBase}/rpc/${name}`, {
    method: 'POST',
    headers: restHeaders(),
    body: JSON.stringify(params),
  });
  const data = await parseResponse(res);
  if (!res.ok) {
    const msg =
      typeof data === 'object' && data?.message
        ? data.message
        : typeof data === 'string'
          ? data
          : `RPC ${name} HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

async function selectRows(table, query) {
  const res = await fetch(`${restBase}/${table}?${query}`, {
    headers: restHeaders({ Accept: 'application/json' }),
  });
  const data = await parseResponse(res);
  if (!res.ok) {
    throw new Error(typeof data === 'object' ? data.message : `SELECT HTTP ${res.status}`);
  }
  return data ?? [];
}

async function insertRow(table, row) {
  const res = await fetch(`${restBase}/${table}`, {
    method: 'POST',
    headers: restHeaders({ Prefer: 'return=representation' }),
    body: JSON.stringify(row),
  });
  const data = await parseResponse(res);
  if (!res.ok) {
    throw new Error(typeof data === 'object' ? data.message : `INSERT HTTP ${res.status}`);
  }
  return Array.isArray(data) ? data[0] : data;
}

async function patchRows(table, filter, patch) {
  const res = await fetch(`${restBase}/${table}?${filter}`, {
    method: 'PATCH',
    headers: restHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const data = await parseResponse(res);
    throw new Error(typeof data === 'object' ? data.message : `PATCH HTTP ${res.status}`);
  }
}

async function importFromGestalt(gestaltUrl) {
  return fetchAndParseGestaltAuthor(gestaltUrl);
}

function needsPhotoMirror(photoUrl) {
  if (!photoUrl) return false;
  if (/gestalt\.ru|geshtalt\.ru/i.test(photoUrl)) return true;
  if (/kong|localhost|127\.0\.0\.1/i.test(photoUrl)) return true;
  const publicPrefix = `${supabaseUrl}/storage/v1/object/public/trainer-photos/`;
  return !photoUrl.startsWith(publicPrefix);
}

async function mirrorPhotoToStorage(remoteUrl, slug) {
  const res = await fetch(remoteUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; MGI-Intensive/1.0)',
      Referer: 'https://gestalt.ru/',
      Accept: 'image/*',
    },
  });
  if (!res.ok) throw new Error(`скачивание фото: HTTP ${res.status}`);
  const contentType = res.headers.get('content-type') ?? 'image/jpeg';
  if (!contentType.startsWith('image/')) throw new Error(`не изображение: ${contentType}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > 5 * 1024 * 1024) throw new Error('фото больше 5 МБ');
  const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
  const path = `imported/${slug.replace(/[^a-z0-9_-]+/gi, '-')}-${Date.now()}.${ext}`;

  const uploadRes = await fetch(`${supabaseUrl}/storage/v1/object/trainer-photos/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      'Content-Type': contentType,
      'Cache-Control': '31536000',
      'x-upsert': 'false',
    },
    body: buf,
  });
  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    throw new Error(`storage: ${err || uploadRes.status}`);
  }
  return `${supabaseUrl}/storage/v1/object/public/trainer-photos/${path}`;
}

const createdCodes = [];
const errors = [];

console.log(`Тренеров в списке: ${TRAINERS_TEAM.length}${dryRun ? ' (dry-run)' : ''}`);

for (let i = 0; i < TRAINERS_TEAM.length; i++) {
  const item = TRAINERS_TEAM[i];
  const gestaltUrl = normalizeUrl(item.url);
  const label = `${i + 1}/${TRAINERS_TEAM.length} ${slugFromUrl(gestaltUrl)}`;

  try {
    const existingRows = await selectRows(
      'intensive_trainers',
      `gestalt_url=eq.${encodeURIComponent(gestaltUrl)}&select=id,profile_id,gestalt_url`,
    );

    let trainerId = existingRows?.[0]?.id;
    let profileId = existingRows?.[0]?.profile_id;

    if (!trainerId && !refreshOnly) {
      if (dryRun) {
        console.log(`[dry-run] создать: ${item.nameHint} ← ${gestaltUrl}`);
        continue;
      }

      const createRes = await rpc('admin_create_profile', {
        p_access_code: adminCode,
        p_full_name: item.nameHint,
        p_role: 'trainer',
      });
      if (!createRes?.ok || !createRes.profile) {
        throw new Error(createRes?.error ?? 'admin_create_profile failed');
      }

      profileId = createRes.profile.id;
      const accessCode = createRes.profile.access_code;
      createdCodes.push({
        full_name: item.nameHint,
        access_code: accessCode,
        gestalt_url: gestaltUrl,
      });

      const card = await insertRow('intensive_trainers', {
        profile_id: profileId,
        gestalt_url: gestaltUrl,
        full_name: item.nameHint,
        city: item.cityHint,
        sort_order: i,
        is_visible: true,
      });
      trainerId = card.id;
      console.log(`✓ профиль + карточка: ${item.nameHint} (код ${accessCode})`);
    } else if (trainerId) {
      console.log(`→ уже есть карточка: ${item.nameHint}`);
    } else if (refreshOnly && !trainerId) {
      console.log(`⊘ пропуск (нет карточки): ${item.nameHint}`);
      continue;
    }

    if (dryRun) continue;

    console.log(`  импорт с gestalt.ru…`);
    const imported = await importFromGestalt(gestaltUrl);

    let photoUrl = imported.photo_url;
    if (photoUrl && needsPhotoMirror(photoUrl)) {
      try {
        photoUrl = await mirrorPhotoToStorage(photoUrl, slugFromUrl(gestaltUrl));
        console.log(`  ✓ фото → storage`);
      } catch (photoErr) {
        const photoMsg = photoErr instanceof Error ? photoErr.message : String(photoErr);
        console.warn(`  ⚠ фото не загружено: ${photoMsg}`);
      }
    } else if (!photoUrl) {
      console.warn(`  ⚠ фото на странице не найдено`);
    }

    await patchRows('intensive_trainers', `id=eq.${trainerId}`, {
      full_name: imported.full_name,
      photo_url: photoUrl,
      status_line: imported.status_line,
      bio: imported.bio,
      specializations: imported.specializations,
      phone: imported.phone,
      email: imported.email,
      city: imported.city ?? item.cityHint,
      gestalt_url: imported.gestalt_url,
      imported_at: new Date().toISOString(),
    });

    if (profileId) {
      await patchRows('profiles', `id=eq.${profileId}`, {
        full_name: imported.full_name,
      });
    }

    console.log(`  ✓ импорт: ${imported.full_name}`);
    await sleep(800);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push({ label, msg });
    console.error(`✗ ${label}: ${msg}`);
    if (msg.includes('enum user_role') && msg.includes('trainer') && errors.length === 1) {
      console.error(
        '\n→ Сначала примените миграцию на VPS:\n' +
          '  docker compose -f ~/supabase/docker/docker-compose.yml exec -T db \\\n' +
          '    psql -U postgres -d postgres < supabase/migrations/010_trainer_role.sql\n',
      );
    }
  }
}

if (createdCodes.length) {
  const outPath = resolve(root, 'scripts', 'trainer-access-codes.json');
  writeFileSync(outPath, JSON.stringify(createdCodes, null, 2), 'utf8');
  console.log(`\nКоды доступа сохранены: ${outPath}`);
}

if (errors.length) {
  console.error(`\nОшибок: ${errors.length}`);
  process.exit(1);
}

console.log('\nГотово.');
