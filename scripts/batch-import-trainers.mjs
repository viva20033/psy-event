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
 * Опционально из .env подхватываются VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY
 * (service role и admin code в .env обычно нет — передайте в командной строке).
 *
 *   node scripts/batch-import-trainers.mjs
 *   node scripts/batch-import-trainers.mjs --dry-run
 *   node scripts/batch-import-trainers.mjs --refresh   # только повторный импорт с сайта
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { TRAINERS_TEAM } from './intensive-trainers-team.mjs';

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

async function importFromGestalt({ supabaseUrl, serviceKey, adminCode, gestaltUrl }) {
  const res = await fetch(`${supabaseUrl.replace(/\/$/, '')}/functions/v1/import-gestalt-trainer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      'x-access-code': adminCode,
    },
    body: JSON.stringify({ gestalt_url: gestaltUrl, mirror_photo: true }),
  });
  const json = await res.json();
  if (!res.ok || !json.ok) {
    throw new Error(json.error ?? `HTTP ${res.status}`);
  }
  return json.data;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

loadDotEnv();

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminCode = process.env.ADMIN_ACCESS_CODE;
const dryRun = process.argv.includes('--dry-run');
const refreshOnly = process.argv.includes('--refresh');

if (!supabaseUrl || !serviceKey || !adminCode) {
  console.error(
    'Нужны SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY и ADMIN_ACCESS_CODE.\n' +
      'Пример (PowerShell):\n' +
      '  $env:SUPABASE_URL="https://api.intensiv-mgi.ru"\n' +
      '  $env:SUPABASE_SERVICE_ROLE_KEY="..."\n' +
      '  $env:ADMIN_ACCESS_CODE="..."\n' +
      '  node scripts/batch-import-trainers.mjs',
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const createdCodes = [];
const errors = [];

console.log(`Тренеров в списке: ${TRAINERS_TEAM.length}${dryRun ? ' (dry-run)' : ''}`);

for (let i = 0; i < TRAINERS_TEAM.length; i++) {
  const item = TRAINERS_TEAM[i];
  const gestaltUrl = normalizeUrl(item.url);
  const label = `${i + 1}/${TRAINERS_TEAM.length} ${slugFromUrl(gestaltUrl)}`;

  try {
    const { data: existingRows, error: findErr } = await supabase
      .from('intensive_trainers')
      .select('id, profile_id, gestalt_url')
      .eq('gestalt_url', gestaltUrl);

    if (findErr) throw findErr;

    let trainerId = existingRows?.[0]?.id;
    let profileId = existingRows?.[0]?.profile_id;

    if (!trainerId && !refreshOnly) {
      if (dryRun) {
        console.log(`[dry-run] создать: ${item.nameHint} ← ${gestaltUrl}`);
        continue;
      }

      const { data: createRes, error: rpcErr } = await supabase.rpc('admin_create_profile', {
        p_access_code: adminCode,
        p_full_name: item.nameHint,
        p_role: 'trainer',
      });
      if (rpcErr) throw rpcErr;
      const res = createRes;
      if (!res?.ok || !res.profile) {
        throw new Error(res?.error ?? 'admin_create_profile failed');
      }

      profileId = res.profile.id;
      const accessCode = res.profile.access_code;
      createdCodes.push({
        full_name: item.nameHint,
        access_code: accessCode,
        gestalt_url: gestaltUrl,
      });

      const { data: card, error: insErr } = await supabase
        .from('intensive_trainers')
        .insert({
          profile_id: profileId,
          gestalt_url: gestaltUrl,
          full_name: item.nameHint,
          city: item.cityHint,
          sort_order: i,
          is_visible: true,
        })
        .select('id')
        .single();
      if (insErr) throw insErr;
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
    const imported = await importFromGestalt({
      supabaseUrl,
      serviceKey,
      adminCode,
      gestaltUrl,
    });

    const { error: updErr } = await supabase
      .from('intensive_trainers')
      .update({
        full_name: imported.full_name,
        photo_url: imported.photo_url,
        status_line: imported.status_line,
        bio: imported.bio,
        specializations: imported.specializations,
        phone: imported.phone,
        email: imported.email,
        city: imported.city ?? item.cityHint,
        gestalt_url: imported.gestalt_url,
        imported_at: new Date().toISOString(),
      })
      .eq('id', trainerId);
    if (updErr) throw updErr;

    if (profileId) {
      await supabase
        .from('profiles')
        .update({ full_name: imported.full_name })
        .eq('id', profileId);
    }

    console.log(`  ✓ импорт: ${imported.full_name}`);
    await sleep(800);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push({ label, msg });
    console.error(`✗ ${label}: ${msg}`);
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
