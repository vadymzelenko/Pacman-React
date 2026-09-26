'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/session';
import { useLang } from '@/lib/i18n';
import { Button, GlassCard } from '@/components/ui';

function randomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export default function MultiplayerPanel() {
  const { supabase, profile } = useSession();
  const router = useRouter();
  const { t } = useLang();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const createRoom = async () => {
    setBusy(true);
    setError('');
    const c = randomCode();
    const seed = Math.floor(Math.random() * 2 ** 31);
    const { data: room, error: e1 } = await supabase
      .from('rooms')
      .insert({ code: c, host_id: profile.id, seed, status: 'waiting' })
      .select()
      .single();
    if (e1) {
      setError(e1.message);
      setBusy(false);
      return;
    }
    await supabase.from('room_players').insert({ room_id: room.id, user_id: profile.id });
    router.push('/multiplayer/' + c);
  };

  const joinRoom = async () => {
    setBusy(true);
    setError('');
    const c = code.trim().toUpperCase();
    if (!c) {
      setError(t('mp.enterCode'));
      setBusy(false);
      return;
    }
    const { data: room, error: e1 } = await supabase.from('rooms').select('*').eq('code', c).single();
    if (e1 || !room) {
      setError(t('mp.roomNotFound'));
      setBusy(false);
      return;
    }
    await supabase.from('room_players').upsert({ room_id: room.id, user_id: profile.id }, { onConflict: 'room_id,user_id' });
    router.push('/multiplayer/' + c);
  };

  return (
    <GlassCard className="p-6">
      <h2 className="font-pixel text-sm text-ink sm:text-base">{t('mp.title')}</h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">{t('mp.subtitle')}</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="glass rounded-2xl p-4">
          <p className="text-sm font-medium text-ink">{t('mp.create')}</p>
          <Button variant="primary" className="mt-3 w-full" onClick={createRoom} disabled={busy}>
            {t('mp.createRoom')}
          </Button>
        </div>
        <div className="glass rounded-2xl p-4">
          <p className="text-sm font-medium text-ink">{t('mp.join')}</p>
          <div className="mt-3 flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={6}
              placeholder={t('mp.codePlaceholder')}
              className="glass h-10 flex-1 rounded-xl px-3 text-sm uppercase tracking-widest text-ink outline-none placeholder:text-muted focus:ring-2 focus:ring-accent/60"
            />
            <Button onClick={joinRoom} disabled={busy}>
              {t('mp.joinRoom')}
            </Button>
          </div>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </GlassCard>
  );
}
