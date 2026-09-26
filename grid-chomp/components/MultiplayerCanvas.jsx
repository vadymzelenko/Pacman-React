'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { createMultiplayerGame } from '@/game/multiplayer';
import { usePrefs } from '@/lib/prefs';
import { useLang } from '@/lib/i18n';
import { Button, Chip } from '@/components/ui';
import Dpad from '@/components/Dpad';

function Stat({ label, value, tone }) {
  const tones = { default: 'text-ink', coin: 'text-coin', danger: 'text-danger' };
  return (
    <div className="glass rounded-xl px-3 py-2">
      <div className="font-pixel text-[8px] text-muted">{label}</div>
      <div className={`mt-1 text-lg font-semibold tabular-nums leading-tight ${tones[tone] || tones.default}`}>{value}</div>
    </div>
  );
}

export default function MultiplayerCanvas({
  supabase,
  roomCode,
  selfId,
  selfName,
  skinId,
  soundPackId,
  musicThemeId,
  isHost,
  onGameOver,
  onPlayersChange,
  onStatus,
  onExit,
}) {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const { sfx, music } = usePrefs();
  const { t } = useLang();
  const [status, setStatus] = useState('connecting');
  const [hud, setHud] = useState({ score: 0, teamCoins: 0, coins: 0, time: 0, police: 0, players: 1, state: 'ready', observer: false, respawnIn: 0 });

  const onGameOverRef = useRef(onGameOver);
  const onPlayersChangeRef = useRef(onPlayersChange);
  onGameOverRef.current = onGameOver;
  onPlayersChangeRef.current = onPlayersChange;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = createMultiplayerGame(canvas, {
      supabase,
      roomCode,
      selfId,
      selfName,
      skinId,
      soundPackId,
      musicThemeId,
      isHost,
      muted: !sfx,
      musicMuted: !music,
      onHud: setHud,
      onGameOver: (r) => onGameOverRef.current?.(r),
      onPlayersChange: (n) => onPlayersChangeRef.current?.(n),
      onStatus: setStatus,
    });
    gameRef.current = game;
    game.start().catch(() => setStatus('error'));
    return () => {
      game.destroy();
      gameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, roomCode, selfId, selfName, skinId, soundPackId, musicThemeId, isHost, sfx, music]);

  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const waiting = status === 'ready' && hud.state === 'ready';

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-bg">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-3 sm:p-4">
        <div className="flex flex-wrap gap-2">
          <Stat label={t('mp.teamScore')} value={hud.score} />
          <Stat label={t('game.coins')} value={hud.coins} tone="coin" />
          <Stat label={t('game.time')} value={fmt(hud.time)} />
        </div>
        <div className="flex items-center gap-2">
          <Chip className="text-ink">
            {t('game.police')} · {hud.police}
          </Chip>
          <Chip className="text-ink">
            {t('mp.players')} · {hud.players}
          </Chip>
          {isHost && (
            <button
              onClick={() => gameRef.current?.togglePause()}
              className="glass pointer-events-auto flex h-10 w-10 items-center justify-center rounded-xl text-ink"
              aria-label="pause"
            >
              ⏸
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {status === 'error' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-20 flex items-center justify-center p-6">
            <div className="glass-strong rounded-2xl p-6 text-center">
              <p className="text-ink">{t('mp.roomNotFound')}</p>
              {onExit && (
                <Button className="mt-4" onClick={onExit}>
                  {t('common.back')}
                </Button>
              )}
            </div>
          </motion.div>
        )}

        {waiting && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-20 flex items-center justify-center p-6">
            <div className="glass-strong rounded-2xl px-8 py-6 text-center">
              <p className="text-lg font-semibold text-ink">{t('mp.waiting')}</p>
              <p className="mt-2 text-sm text-muted">{t('mp.room')} {roomCode}</p>
            </div>
          </motion.div>
        )}

        {hud.observer && hud.state !== 'over' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="absolute inset-x-0 top-20 z-20 flex justify-center px-4">
            <div className="glass-strong rounded-2xl px-5 py-3 text-center">
              <p className="text-sm font-medium text-ink">{t('mp.observer')}</p>
              <p className="mt-0.5 text-xs text-muted">
                {t('mp.respawnIn')} {hud.respawnIn}s
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center p-5 sm:hidden">
        <div className="pointer-events-auto">
          <Dpad onDir={(d) => gameRef.current?.setInput(d)} />
        </div>
      </div>
    </div>
  );
}
