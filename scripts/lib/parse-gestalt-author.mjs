/**
 * Парсинг gestalt.ru/author/... — общая логика для batch-импорта.
 * Дублирует supabase/functions/import-gestalt-trainer/index.ts
 */

function decodeEntities(s) {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function htmlToPlainText(html) {
  let s = html;
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/p>/gi, '\n\n');
  s = s.replace(/<\/li>/gi, '\n');
  s = s.replace(/<\/div>/gi, '\n');
  s = s.replace(/<\/h[1-6]>/gi, '\n');
  s = s.replace(/<li[^>]*>/gi, '\n');
  s = s.replace(/<[^>]+>/g, '');
  s = decodeEntities(s);
  return s
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function htmlToPlainTextInline(html) {
  return decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function extractSectionHtml(html, heading) {
  const re = new RegExp(
    `<h2[^>]*>\\s*${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*</h2>([\\s\\S]*?)(?=<h2[^>]*>|$)`,
    'i',
  );
  const m = html.match(re);
  return m?.[1]?.trim() ?? null;
}

function extractSection(html, heading) {
  const raw = extractSectionHtml(html, heading);
  if (!raw) return null;
  return htmlToPlainText(raw).slice(0, 12000) || null;
}

function extractPhotoUrl(html) {
  const block = html.match(/id="member-photo-holder"[\s\S]*?<\/div>/i)?.[0];
  if (!block) return null;
  const dataSrc = block.match(/data-src="([^"]+)"/i)?.[1];
  const src = block.match(/\ssrc="(https?:[^"]+)"/i)?.[1];
  const candidate = dataSrc ?? src ?? null;
  if (!candidate || candidate.startsWith('data:')) return null;
  return candidate.replace(/&amp;/g, '&');
}

function extractSpecializations(html) {
  const section = extractSectionHtml(html, 'Специализация');
  if (!section) return null;

  const items = [...section.matchAll(/<li[^>]*class=['"][^'"]*skill-item[^'"]*['"][^>]*>([\s\S]*?)<\/li>/gi)]
    .map((m) => htmlToPlainTextInline(m[1]))
    .filter(Boolean);

  if (items.length > 0) return items.join('\n');
  return htmlToPlainText(section).slice(0, 12000) || null;
}

function extractStatusLine(html) {
  const section = extractSectionHtml(html, 'Статус в сообществе');
  if (!section) return null;
  const lines = htmlToPlainText(section)
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  return lines.length > 0 ? lines.join('\n') : null;
}

function extractContacts(html) {
  const card =
    html.match(
      /<h1[^>]*class=['"][^'"]*user-title[^'"]*['"][^>]*>[\s\S]*?<\/div>\s*<\/div>/i,
    )?.[0] ?? '';

  const phone =
    card.match(/class=['"]member-phone['"][^>]*>([^<]+)/i)?.[1]?.replace(/\s+/g, ' ').trim() ??
    null;
  const emailFromLink = card.match(/href="mailto:([^"]+)"/i)?.[1]?.trim() ?? null;
  const emailFromText =
    [...card.matchAll(/<div class=['"]mb-1['"][^>]*>([\s\S]*?)<\/div>/gi)]
      .map((m) => htmlToPlainTextInline(m[1]))
      .find((t) => t && t.includes('@')) ?? null;
  const email = emailFromLink ?? emailFromText;
  const city =
    [...card.matchAll(/<div class=['"]mb-1['"][^>]*>([\s\S]*?)<\/div>/gi)]
      .map((m) => htmlToPlainTextInline(m[1]))
      .find((t) => t && !t.includes('@') && !/^\+?\d[\d\s()-]{6,}/.test(t)) ?? null;

  return { phone, email, city };
}

export function parseGestaltAuthorHtml(html, gestaltUrl) {
  const h1 = html.match(/<h1[^>]*class=['"][^'"]*user-title[^'"]*['"][^>]*>([\s\S]*?)<\/h1>/i);
  const full_name = h1 ? htmlToPlainTextInline(h1[1]) : null;
  if (!full_name) throw new Error('Не найдено имя на странице (тег h1)');

  const contacts = extractContacts(html);

  return {
    full_name,
    photo_url: extractPhotoUrl(html),
    status_line: extractStatusLine(html),
    bio: extractSection(html, 'Описание профессиональной деятельности'),
    specializations: extractSpecializations(html),
    phone: contacts.phone,
    email: contacts.email,
    city: contacts.city,
    gestalt_url: gestaltUrl,
  };
}

export async function fetchAndParseGestaltAuthor(gestaltUrl) {
  const res = await fetch(gestaltUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; MGI-Intensive/1.0)',
      Accept: 'text/html',
    },
  });
  if (!res.ok) throw new Error(`Сайт ответил ${res.status}`);
  const html = await res.text();
  return parseGestaltAuthorHtml(html, gestaltUrl);
}
