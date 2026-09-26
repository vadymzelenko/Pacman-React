'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/session';
import { useLang } from '@/lib/i18n';
import { getBoost } from '@/lib/catalog';
import GameCanvas from '@/components/GameCanvas';
import { Button, GlassCard } from '@/components/ui';

export default function GamePage() {
  const router = useRouter();
  const { t } = useLang();
  const { profile, loading, supabase, refresh } = useSession();
  const [result, setResult] = useState(null);
  const [seed] = useState(() => Date.now());
  const [boost, setBoost] = useState(null);
  const [boostParam, setBoostParam] = useState(null);
  const savedRef = useRef(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('boost');
    if (p) setBoostParam(p);
  }, []);

  useEffect(() => {
    if (!boostParam || !profile?.id) return;
    const b = getBoost(boostParam);
    if (!b) return;
    setBoost(b);
    supabase.rpc('consume_boost', { p_item_id: b.id });
  }, [boostParam, profile?.id, supabase]);

  const skinId = profile?.equipped_skin || 'indigo';
  const soundPackId = profile?.equipped_sound || 'classic';
  const musicThemeId = profile?.equipped_music || 'ambient';

  const saveOnce = async (r) => {
    if (savedRef.current) return;
    savedRef.current = true;
    if (profile?.id) {
      await supabase.rpc('add_score', { p_score: r.score, p_level: 1, p_coins: r.coins, p_survived: r.survived });
      refresh();
    }
  };

  const handleGameOver = (r) => {
    setResult(r);
    saveOnce(r);
  };

  const restart = () => window.location.reload();
  const goProfile = () => router.push(profile?.id ? '/dashboard' : '/');

  if (loading) {
    return <div className="flex h-[100dvh] items-center justify-center text-muted">{t('common.loading')}</div>;
  }

  return (
    <>
      <GameCanvas
        seed={seed}
        skinId={skinId}
        soundPackId={soundPackId}
        musicThemeId={musicThemeId}
        boost={boost}
        onGameOver={handleGameOver}
        onExit={goProfile}
      />

      {result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
          <GlassCard className="w-full max-w-sm p-6 text-center">
            <h2 className="text-2xl font-semibold text-ink">{t('game.gameOver')}</h2>
            <p className="mt-4 text-sm uppercase tracking-wider text-muted">{t('game.score')}</p>
            <p className="mt-1 text-4xl font-bold tabular-nums text-ink">{result.score}</p>

            <div className="mt-5 grid grid-cols-2 gap-2 text-sm">
              <div className="glass rounded-xl p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted">{t('game.coins')}</div>
                <div className="text-lg font-semibold text-coin">+{result.coins}</div>
              </div>
              <div className="glass rounded-xl p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted">{t('game.survived')}</div>
                <div className="text-lg font-semibold text-ink">{result.time}s</div>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2">
              <Button variant="primary" onClick={restart}>
                {t('game.playAgain')}
              </Button>
              <Button variant="secondary" onClick={goProfile}>
                {profile?.id ? t('nav.profile') : t('game.home')}
              </Button>
              <Button variant="ghost" onClick={() => router.push('/leaderboard')}>
                {t('game.leaders')}
              </Button>
            </div>
          </GlassCard>
        </div>
      )}
    </>
  );
}
