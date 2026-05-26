export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL as string,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
  vapidPublicKey: (import.meta.env.VITE_VAPID_PUBLIC_KEY as string) || '',
  organizerPhone:
    (import.meta.env.VITE_ORGANIZER_PHONE as string) || '+7 (XXX) XXX-XX-XX',
};

export function isConfigured(): boolean {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}

export function isPushConfigured(): boolean {
  return isConfigured() && Boolean(env.vapidPublicKey);
}
