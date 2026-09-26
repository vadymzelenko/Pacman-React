'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from '@/lib/session';
import { useLang } from '@/lib/i18n';
import MultiplayerCanvas from '@/components/MultiplayerCanvas';
import { Button, GlassCard, Chip } from '@/components/ui';

export default function RoomPage() {
  const params = useParams();
  const code = params.code;
  const { supabase, profile, loading, refresh } = useSession();
  const router = useRouter();
  const { t } = useLang();
  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState(1);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!code) return;
    supabase
      .from('rooms')
      .select('*')
      .eq('code', code)
      .single()
      .then(({ data }) => {
        if (!data) setError(t('mp.roomNotFound'));
        else setRoom(data);
      });
  }, [supabase, code, t]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      /* ignore */
    }
  };

  const handleGameOver = async (r) => {
    setResult(r);
    if (!profile?.id) return;
    await supabase.rpc('add_coins', { p_coins: r.selfCoins || 0 });
    if (room && room.host_id === profile.id) {
      await supabase.rpc('save_coop_result', { p_room_id: room.id, p_score: r.score, p_survived: r.survived });
    }
    refresh();
  };

  if (loading) {
    return <div className="flex min-h-[100dvh] items-center justify-center text-muted">{t('common.loading')}</div>;
  }

  if (!profile) {
    router.replace('/login');
    return null;
  }

  if (error) {
    return (
      <div className="min-h-[100dvh]">
        <div className="flex flex-col items-center justify-center pt-40">
          <p className="text-muted">{error}</p>
          <Button className="mt-4" onClick={() => router.push('/dashboard')}>
            {t('common.back')}
          </Button>
        </div>
      </div>
    );
  }

  if (!room) {
    return <div className="flex min-h-[100dvh] items-center justify-center text-muted">{t('common.loading')}</div>;
  }

  const isHost = room.host_id === profile.id;

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-30 flex items-center justify-between gap-2 p-3 sm:p-4">
        <button onClick={() => router.push('/dashboard')} className="glass flex h-10 items-center gap-2 rounded-xl px-3 text-sm text-ink">
          ← {t('mp.backLobby')}
        </button>
        <div className="flex items-center gap-2">
          <Chip className="text-ink">
            {t('mp.room')} · {code}
          </Chip>
          <Chip className="text-ink">
            {t('mp.players')} · {players}
          </Chip>
          <button onClick={copy} className="glass flex h-10 items-center rounded-xl px-3 text-sm text-ink">
            {copied ? t('mp.copied') : t('mp.copy')}
          </button>
        </div>
      </div>

      <MultiplayerCanvas
        supabase={supabase}
        roomCode={code}
        selfId={profile.id}
        selfName={profile.username}
        skinId={profile.equipped_skin}
        soundPackId={profile.equipped_sound}
        musicThemeId={profile.equipped_music}
        isHost={isHost}
        onGameOver={handleGameOver}
        onPlayersChange={setPlayers}
        onExit={() => router.push('/dashboard')}
      />

      {result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
          <GlassCard className="w-full max-w-sm p-6 text-center">
            <h2 className="text-2xl font-semibold text-ink">{t('game.gameOver')}</h2>
            <p className="mt-4 text-sm uppercase tracking-wider text-muted">{t('mp.teamScore')}</p>
            <p className="mt-1 text-4xl font-bold tabular-nums text-ink">{result.score}</p>
            <div className="mt-5 grid grid-cols-2 gap-2 text-sm">
              <div className="glass rounded-xl p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted">{t('game.coins')}</div>
                <div className="text-lg font-semibold text-coin">+{result.selfCoins}</div>
              </div>
              <div className="glass rounded-xl p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted">{t('mp.survived')}</div>
                <div className="text-lg font-semibold text-ink">{result.time}s</div>
              </div>
            </div>
            <Button variant="primary" className="mt-6 w-full" onClick={() => router.push('/dashboard')}>
              {t('nav.profile')}
            </Button>
          </GlassCard>
        </div>
      )}
    </>
  );
}
