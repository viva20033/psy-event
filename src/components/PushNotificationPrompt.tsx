import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  getPushPref,
  hasVapidKey,
  isPushSupported,
  setPushPref,
  subscribeToPush,
} from '@/services/push';

export function PushNotificationPrompt() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  if (!isPushSupported() || !hasVapidKey()) return null;

  const pref = getPushPref();
  if (pref === 'granted') return null;
  if (pref === 'denied') {
    return (
      <Card className="bg-slate-50 border-slate-200 text-sm text-slate-600">
        Уведомления отключены в настройках браузера. Включите их для этого сайта, чтобы получать
        объявления.
      </Card>
    );
  }

  async function enable() {
    setStatus('loading');
    const result = await subscribeToPush();
    if (result.ok) {
      setStatus('done');
      setMessage('Готово! Вы будете получать push о новых объявлениях.');
    } else {
      setStatus('error');
      setMessage(result.error ?? 'Не удалось подписаться');
    }
  }

  if (status === 'done') {
    return (
      <Card className="bg-green-50 border-green-200 text-sm text-green-900">{message}</Card>
    );
  }

  return (
    <Card className="bg-primary-50 border-primary-100 space-y-3">
      <p className="text-sm text-primary-900">
        <strong>Уведомления об объявлениях.</strong> Получайте push, когда организаторы публикуют
        новости (работает при установленном PWA или открытой вкладке в Chrome/Safari).
      </p>
      {status === 'error' && <p className="text-sm text-red-600">{message}</p>}
      <div className="flex gap-2">
        <Button size="sm" onClick={enable} disabled={status === 'loading'}>
          {status === 'loading' ? 'Подключение…' : 'Включить уведомления'}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setPushPref('denied')}>
          Не сейчас
        </Button>
      </div>
    </Card>
  );
}
