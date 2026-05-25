import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { loginWithCode } from '@/services/auth';
import { pullAllData } from '@/lib/offline/sync';
import { useSession } from '@/stores/session';
import { isConfigured } from '@/config/env';

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const [code, setCode] = useState(searchParams.get('code') ?? '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setProfile = useSession((s) => s.setProfile);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (!isConfigured()) {
        throw new Error('Supabase не настроен. Заполните .env');
      }
      const profile = await loginWithCode(code);
      await setProfile(profile);
      try {
        await pullAllData();
      } catch {
        // offline after login is ok
      }
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-primary-700 px-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center text-white">
          <h1 className="text-2xl font-bold">МГИ Сочи</h1>
          <p className="mt-2 text-primary-100">Гештальт-интенсив</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl bg-white p-6 shadow-lg">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Код доступа</span>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="XXXXXXXX"
              maxLength={8}
              autoComplete="off"
              autoCapitalize="characters"
              className="text-center tracking-widest font-mono"
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" fullWidth disabled={loading || code.length < 4}>
            {loading ? 'Вход…' : 'Войти'}
          </Button>
        </form>
      </div>
    </div>
  );
}
