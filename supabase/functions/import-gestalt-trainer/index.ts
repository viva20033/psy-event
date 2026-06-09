import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-access-code',
};

const ALLOWED_HOSTS = ['gestalt.ru', 'www.gestalt.ru', 'geshtalt.ru', 'www.geshtalt.ru'];

export interface GestaltImportResult {
  full_name: string;
  photo_url: string | null;
  status_line: string | null;
  bio: string | null;
  specializations: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  gestalt_url: string;
}

function normalizeGestaltUrl(raw: string): string {
  const trimmed = raw.trim();
  const withProto = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
  const u = new URL(withProto);
  const host = u.hostname.replace(/^www\./, '');
  if (!ALLOWED_HOSTS.some((h) => h.replace(/^www\./, '') === host)) {
    throw new Error('Разрешены только ссылки gestalt.ru / geshtalt.ru (страница /author/...)');
  }
  if (!u.pathname.includes('/author/')) {
    throw new Error('Нужна ссылка на страницу автора, например gestalt.ru/author/slug/');
  }
  u.hash = '';
  if (!u.pathname.endsWith('/')) u.pathname += '/';
  return u.toString();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

/** Текст из HTML с сохранением переносов (br, p, li, div). */
function htmlToPlainText(html: string): string {
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

function htmlToPlainTextInline(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function extractSectionHtml(html: string, heading: string): string | null {
  const re = new RegExp(
    `<h2[^>]*>\\s*${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*</h2>([\\s\\S]*?)(?=<h2[^>]*>|$)`,
    'i',
  );
  const m = html.match(re);
  return m?.[1]?.trim() ?? null;
}

function extractSection(html: string, heading: string): string | null {
  const raw = extractSectionHtml(html, heading);
  if (!raw) return null;
  return htmlToPlainText(raw).slice(0, 12000) || null;
}

function extractSpecializations(html: string): string | null {
  const section = extractSectionHtml(html, 'Специализация');
  if (!section) return null;

  const items = [...section.matchAll(/<li[^>]*class=['"][^'"]*skill-item[^'"]*['"][^>]*>([\s\S]*?)<\/li>/gi)]
    .map((m) => htmlToPlainTextInline(m[1]))
    .filter(Boolean);

  if (items.length > 0) {
    return items.join('\n');
  }

  return htmlToPlainText(section).slice(0, 12000) || null;
}

function extractStatusLine(html: string): string | null {
  const section = extractSectionHtml(html, 'Статус в сообществе');
  if (!section) return null;
  const lines = htmlToPlainText(section)
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  return lines.length > 0 ? lines.join('\n') : null;
}

function extractPhotoUrl(html: string): string | null {
  const block = html.match(/id="member-photo-holder"[\s\S]*?<\/div>/i)?.[0];
  if (!block) return null;
  const dataSrc = block.match(/data-src="([^"]+)"/i)?.[1];
  const src = block.match(/\ssrc="(https?:[^"]+)"/i)?.[1];
  const candidate = dataSrc ?? src ?? null;
  if (!candidate || candidate.startsWith('data:')) return null;
  return candidate.replace(/&amp;/g, '&');
}

function extractH1Name(html: string): string | null {
  const m = html.match(/<h1[^>]*class=['"][^'"]*user-title[^'"]*['"][^>]*>([\s\S]*?)<\/h1>/i);
  return m ? htmlToPlainTextInline(m[1]) : null;
}

function extractContacts(html: string): {
  phone: string | null;
  email: string | null;
  city: string | null;
} {
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

export function parseGestaltAuthorHtml(html: string, gestaltUrl: string): GestaltImportResult {
  const full_name = extractH1Name(html);
  if (!full_name) throw new Error('Не найдено имя на странице (тег h1)');

  const status_line = extractStatusLine(html);
  const bio = extractSection(html, 'Описание профессиональной деятельности');
  const specializations = extractSpecializations(html);
  const contacts = extractContacts(html);

  return {
    full_name,
    photo_url: extractPhotoUrl(html),
    status_line,
    bio,
    specializations,
    phone: contacts.phone,
    email: contacts.email,
    city: contacts.city,
    gestalt_url: gestaltUrl,
  };
}

async function isStaff(
  supabase: ReturnType<typeof createClient>,
  accessCode: string | null,
): Promise<boolean> {
  if (!accessCode) return false;
  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('access_code', accessCode)
    .eq('is_active', true)
    .maybeSingle();
  const role = data?.role as string | undefined;
  return role === 'organizer' || role === 'admin';
}

function storagePublicUrl(bucket: string, objectPath: string): string {
  const base =
    Deno.env.get('SUPABASE_PUBLIC_URL') ??
    Deno.env.get('API_EXTERNAL_URL') ??
    Deno.env.get('SUPABASE_URL') ??
    '';
  return `${base.replace(/\/$/, '')}/storage/v1/object/public/${bucket}/${objectPath}`;
}

async function mirrorPhotoToStorage(
  supabase: ReturnType<typeof createClient>,
  remoteUrl: string,
  slug: string,
): Promise<string | null> {
  try {
    const res = await fetch(remoteUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MGI-Intensive-PWA/1.0)',
        Referer: 'https://gestalt.ru/',
        Accept: 'image/*',
      },
    });
    if (!res.ok) {
      console.error('mirror photo fetch', res.status, remoteUrl);
      return null;
    }
    const contentType = res.headers.get('content-type') ?? 'image/jpeg';
    if (!contentType.startsWith('image/')) {
      console.error('mirror photo not image', contentType);
      return null;
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength > 5 * 1024 * 1024) return null;
    const ext = contentType.includes('png')
      ? 'png'
      : contentType.includes('webp')
        ? 'webp'
        : 'jpg';
    const path = `imported/${slug.replace(/[^a-z0-9_-]+/gi, '-')}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('trainer-photos').upload(path, buf, {
      contentType,
      cacheControl: '31536000',
      upsert: false,
    });
    if (error) {
      console.error('storage upload', error.message);
      return null;
    }
    return storagePublicUrl('trainer-photos', path);
  } catch (e) {
    console.error('mirror photo', e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const accessCode = req.headers.get('x-access-code');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    if (!(await isStaff(supabase, accessCode))) {
      return new Response(JSON.stringify({ ok: false, error: 'forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const gestalt_url = normalizeGestaltUrl(String(body.gestalt_url ?? ''));
    const mirrorPhoto = body.mirror_photo !== false;

    const pageRes = await fetch(gestalt_url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MGI-Intensive-PWA/1.0)',
        Accept: 'text/html',
      },
    });
    if (!pageRes.ok) {
      throw new Error(`Сайт ответил ${pageRes.status}`);
    }
    const html = await pageRes.text();
    const parsed = parseGestaltAuthorHtml(html, gestalt_url);

    let photo_url = parsed.photo_url;
    if (mirrorPhoto && photo_url) {
      const slug = new URL(gestalt_url).pathname.split('/').filter(Boolean).pop() ?? 'trainer';
      const mirrored = await mirrorPhotoToStorage(supabase, photo_url, slug);
      if (mirrored) photo_url = mirrored;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        data: { ...parsed, photo_url },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : 'import failed';
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
