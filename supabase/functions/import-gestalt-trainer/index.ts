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

function decodeHtml(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractSection(html: string, heading: string): string | null {
  const re = new RegExp(
    `<h2[^>]*>\\s*${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*</h2>([\\s\\S]*?)(?=<h2[^>]*>|$)`,
    'i',
  );
  const m = html.match(re);
  if (!m) return null;
  return decodeHtml(m[1]).slice(0, 12000) || null;
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
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return m ? decodeHtml(m[1]) : null;
}

function extractContactsBeforeH2(html: string): {
  phone: string | null;
  email: string | null;
  city: string | null;
} {
  const chunk = html.match(/<h1[^>]*>[\s\S]*?<\/h1>([\s\S]*?)(?=<h2|$)/i)?.[1] ?? '';
  const text = decodeHtml(chunk.replace(/<a[^>]*href="mailto:([^"]+)"[^>]*>[\s\S]*?<\/a>/gi, ' $1 '));
  const email =
    chunk.match(/href="mailto:([^"]+)"/i)?.[1]?.trim() ??
    text.match(/[\w.+-]+@[\w.-]+\.\w{2,}/)?.[0] ??
    null;
  const phone =
    text.match(/\+?\d[\d\s()-]{8,}\d/)?.[0]?.replace(/\s+/g, ' ').trim() ?? null;
  const lines = text
    .split(/\n|\.|,/)
    .map((l) => l.trim())
    .filter((l) => l && l.length < 80 && !l.includes('@') && !/^\+?\d/.test(l));
  const city = lines.find((l) => /^[А-Яа-яA-Za-z]/.test(l) && !/тренер|терапевт/i.test(l)) ?? null;
  return { phone, email, city };
}

export function parseGestaltAuthorHtml(html: string, gestaltUrl: string): GestaltImportResult {
  const full_name = extractH1Name(html);
  if (!full_name) throw new Error('Не найдено имя на странице (тег h1)');

  const statusBlock = extractSection(html, 'Статус в сообществе');
  const status_line = statusBlock
    ? statusBlock
        .split(/\n+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .join(' · ')
    : null;

  const bio = extractSection(html, 'Описание профессиональной деятельности');
  const specializations = extractSection(html, 'Специализация');
  const contacts = extractContactsBeforeH2(html);

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

async function mirrorPhotoToStorage(
  supabase: ReturnType<typeof createClient>,
  remoteUrl: string,
  slug: string,
): Promise<string | null> {
  try {
    const res = await fetch(remoteUrl, {
      headers: { 'User-Agent': 'MGI-Intensive-PWA/1.0 (import)' },
    });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') ?? 'image/jpeg';
    if (!contentType.startsWith('image/')) return null;
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
    const { data } = supabase.storage.from('trainer-photos').getPublicUrl(path);
    return data.publicUrl;
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
