import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormField, adminTextareaClass } from '@/components/admin/FormField';
import { TrainerCardDetail } from '@/components/trainers/TrainerCardDetail';
import { useSession } from '@/stores/session';
import { ROLE_LABELS, type IntensiveTrainer } from '@/types';
import { fetchTrainerByProfileId, updateOwnTrainerCard } from '@/services/trainers';
import { uploadImage } from '@/lib/supabase/uploadImage';
import { pullIntensiveTrainers } from '@/lib/offline/sync';

export function ProfilePage() {
  const profile = useSession((s) => s.profile);
  const [trainer, setTrainer] = useState<IntensiveTrainer | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    full_name: '',
    bio: '',
    specializations: '',
    phone: '',
    email: '',
    city: '',
    photo_url: '',
  });

  useEffect(() => {
    if (!profile) return;
    setLoading(true);
    fetchTrainerByProfileId(profile.id)
      .then((t) => {
        setTrainer(t);
        if (t) {
          setForm({
            full_name: t.full_name,
            bio: t.bio ?? '',
            specializations: t.specializations ?? '',
            phone: t.phone ?? '',
            email: t.email ?? '',
            city: t.city ?? '',
            photo_url: t.photo_url ?? '',
          });
        }
      })
      .finally(() => setLoading(false));
  }, [profile]);

  async function saveCard() {
    if (!trainer) return;
    setSaving(true);
    setMessage(null);
    try {
      await updateOwnTrainerCard(trainer.id, form);
      const updated = await fetchTrainerByProfileId(trainer.profile_id);
      setTrainer(updated);
      setEditing(false);
      setMessage('Сохранено');
      await pullIntensiveTrainers();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  }

  async function onPhotoFile(file: File) {
    try {
      const url = await uploadImage(
        'trainer-photos',
        `profile/${profile?.id ?? 'me'}`,
        file,
        'supabase/migrations/008_intensive_trainers.sql',
      );
      setForm((f) => ({ ...f, photo_url: url }));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Ошибка загрузки фото');
    }
  }

  if (!profile) return null;

  return (
    <AppShell title="Мой профиль">
      <div className="space-y-4">
        <Card>
          <p className="text-sm text-slate-500">Участник интенсива</p>
          <h2 className="text-xl font-bold text-primary-900">{profile.full_name}</h2>
          <p className="text-sm text-slate-600">{ROLE_LABELS[profile.role]}</p>
        </Card>

        {loading && <p className="text-center text-slate-500 text-sm">Загрузка…</p>}

        {!loading && !trainer && (
          <Card className="text-sm text-slate-600 space-y-2">
            <p>У вас пока нет публичной карточки тренера в справочнике.</p>
            <p className="text-slate-500">
              Если вы тренер интенсива — попросите организаторов добавить вас в админке и
              привязать к вашему участнику.
            </p>
            <Link to="/information?tab=trainers">
              <Button variant="secondary" fullWidth>
                Справочник тренеров
              </Button>
            </Link>
          </Card>
        )}

        {trainer && !editing && (
          <>
            <Card className="bg-primary-50 border-primary-100 text-sm text-primary-900">
              Это ваша карточка в разделе «Тренеры». Участники видят её в справочнике и в «Мои
              группы».
            </Card>
            <Card>
              <TrainerCardDetail trainer={trainer} />
            </Card>
            <Button variant="secondary" fullWidth onClick={() => setEditing(true)}>
              Редактировать карточку
            </Button>
            <Link to="/information?tab=trainers">
              <Button variant="ghost" fullWidth>
                Как видят другие в справочнике
              </Button>
            </Link>
          </>
        )}

        {trainer && editing && (
          <Card className="space-y-3">
            <h3 className="font-semibold text-primary-900">Редактирование карточки</h3>
            {form.photo_url && (
              <img
                src={form.photo_url}
                alt=""
                className="w-32 h-32 rounded-xl object-cover"
              />
            )}
            <FormField label="Фото">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onPhotoFile(f);
                }}
                className="text-sm"
              />
            </FormField>
            <FormField label="Имя в справочнике">
              <Input
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
              />
            </FormField>
            <FormField label="Город">
              <Input
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              />
            </FormField>
            <FormField label="Телефон">
              <Input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </FormField>
            <FormField label="Email">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </FormField>
            <FormField label="О себе">
              <textarea
                className={adminTextareaClass}
                rows={6}
                value={form.bio}
                onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
              />
            </FormField>
            <FormField label="Специализация">
              <textarea
                className={adminTextareaClass}
                rows={4}
                value={form.specializations}
                onChange={(e) => setForm((f) => ({ ...f, specializations: e.target.value }))}
              />
            </FormField>
            <div className="flex gap-2">
              <Button fullWidth disabled={saving} onClick={() => void saveCard()}>
                {saving ? 'Сохранение…' : 'Сохранить'}
              </Button>
              <Button
                variant="secondary"
                fullWidth
                onClick={() => {
                  setEditing(false);
                  if (trainer) {
                    setForm({
                      full_name: trainer.full_name,
                      bio: trainer.bio ?? '',
                      specializations: trainer.specializations ?? '',
                      phone: trainer.phone ?? '',
                      email: trainer.email ?? '',
                      city: trainer.city ?? '',
                      photo_url: trainer.photo_url ?? '',
                    });
                  }
                }}
              >
                Отмена
              </Button>
            </div>
          </Card>
        )}

        {message && (
          <p className="text-sm text-center text-primary-700">{message}</p>
        )}

        <Link to="/">
          <Button variant="ghost" fullWidth>
            На главную
          </Button>
        </Link>
      </div>
    </AppShell>
  );
}
