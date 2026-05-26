import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-access-code',
};

interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  priority: string;
  is_published: boolean;
  image_url: string | null;
}

interface SubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth_key: string;
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    const subject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:organizer@mgi.ru';

    if (!publicKey || !privateKey) {
      return new Response(
        JSON.stringify({ ok: false, error: 'VAPID keys not configured on server' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const accessCode = req.headers.get('x-access-code');
    if (!(await isStaff(supabase, accessCode))) {
      return new Response(JSON.stringify({ ok: false, error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { announcement_id } = await req.json();
    if (!announcement_id) {
      return new Response(JSON.stringify({ ok: false, error: 'announcement_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: announcement, error: annErr } = await supabase
      .from('announcements')
      .select('id, title, body, priority, is_published, image_url')
      .eq('id', announcement_id)
      .single();

    if (annErr || !announcement) {
      return new Response(JSON.stringify({ ok: false, error: 'Announcement not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const ann = announcement as AnnouncementRow;
    if (!ann.is_published) {
      return new Response(JSON.stringify({ ok: true, sent: 0, skipped: 'not published' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: subs, error: subsErr } = await supabase.from('push_subscriptions').select('endpoint, p256dh, auth_key');
    if (subsErr) throw subsErr;

    const subscriptions = (subs ?? []) as SubscriptionRow[];
    if (subscriptions.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);

    const priorityPrefix = ann.priority === 'urgent' ? '🚨 ' : ann.priority === 'important' ? '❗ ' : '';
    const payload = JSON.stringify({
      title: `${priorityPrefix}${ann.title}`,
      body: ann.body.slice(0, 180),
      url: '/announcements',
      icon: ann.image_url || '/icons/icon-192.png',
      tag: `announcement-${ann.id}`,
    });

    let sent = 0;
    const staleEndpoints: string[] = [];

    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth_key },
            },
            payload,
          );
          sent += 1;
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            staleEndpoints.push(sub.endpoint);
          }
        }
      }),
    );

    if (staleEndpoints.length > 0) {
      await supabase.from('push_subscriptions').delete().in('endpoint', staleEndpoints);
    }

    return new Response(JSON.stringify({ ok: true, sent, total: subscriptions.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
