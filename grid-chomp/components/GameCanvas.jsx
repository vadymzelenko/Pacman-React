'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { createGame } from '@/game/engine';
import { usePrefs } from '@/lib/prefs';
import { useLang } from '@/lib/i18n';
import { Button, Chip } from '@/components/ui';
import Dpad from '@/components/Dpad';

function Stat({ label, value, tone }) {
  const tones = {
    default: 'text-ink',
    coin: 'text-coin',
    danger: 'text-danger',
  };
  return (
    <div className="glass rounded-xl px-3 py-2">
      <div className="font-pixel text-[8px] text-muted">{label}</div>
      <div className={`mt-1 text-lg font-semibold tabular-nums leading-tight ${tones[tone] || tones.default}`}>{value}</div>
    </div>
  );
}

const FX_META = {
  magnet: { glyph: 'M', color: '#f59e0b' },
  ghost: { glyph: 'G', color: '#22d3ee' },
  power: { glyph: 'P', color: '#f43f5e' },
  speed: { glyph: 'S', color: '#10b981' },
  shield: { glyph: 'D', color: '#3b82f6' },
};

export default function GameCanvas({ seed, skinId, soundPackId, musicThemeId, boost, onGameOver, onReady, onExit }) {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const { sfx, music } = usePrefs();
  const { t } = useLang();
  const [hud, setHud] = useState({ score: 0, coins: 0, time: 0, police: 0, state: 'ready', shield: 0, effects: [] });

  const onGameOverRef = useRef(onGameOver);
  const onReadyRef = useRef(onReady);
  onGameOverRef.current = onGameOver;
  onReadyRef.current = onReady;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = createGame(canvas, {
      seed,
      skinId,
      soundPackId,
      musicThemeId,
      boost,
      muted: !sfx,
      musicMuted: !music,
      onHud: setHud,
      onGameOver: (r) => onGameOverRef.current?.(r),
    });
    gameRef.current = game;
    onReadyRef.current?.(game);
    game.start();
    return () => {
      game.destroy();
      gameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, skinId, soundPackId, musicThemeId, boost?.id, sfx, music]);

  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-bg">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-3 sm:p-4">
        <div className="flex flex-wrap gap-2">
          <Stat label={t('game.score')} value={hud.score} />
          <Stat label={t('game.coins')} value={hud.coins} tone="coin" />
          <Stat label={t('game.time')} value={fmt(hud.time)} />
          {hud.shield > 0 && <Stat label={t('game.shield')} value={hud.shield} tone="danger" />}
        </div>
        {hud.effects && hud.effects.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {hud.effects.map((e) => {
              const m = FX_META[e.type] || { glyph: '?', color: '#fff' };
              return (
                <span
                  key={e.type}
                  className="glass rounded-full px-2.5 py-1 text-xs font-semibold text-ink"
                  style={{ borderColor: m.color + '66' }}
                >
                  <span style={{ color: m.color }}>{m.glyph}</span> {e.time}s
                </span>
              );
            })}
          </div>
        )}
        <div className="flex items-center gap-2">
          <Chip className="text-ink">
            {t('game.police')} · {hud.police}
          </Chip>
          <button
            onClick={() => gameRef.current?.togglePause()}
            className="glass pointer-events-auto flex h-10 w-10 items-center justify-center rounded-xl text-ink"
            aria-label="pause"
          >
            ⏸
          </button>
        </div>
      </div>

      <AnimatePresence>
        {hud.state === 'ready' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 flex items-center justify-center p-6"
          >
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => gameRef.current?.startPlay()}
              className="glass-strong rounded-2xl px-8 py-5 text-lg font-semibold text-ink"
            >
              {t('game.tapToStart')}
            </motion.button>
          </motion.div>
        )}

        {hud.state === 'paused' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm"
          >
            <div className="glass-strong w-full max-w-xs rounded-2xl p-6 text-center">
              <h2 className="text-xl font-semibold text-ink">{t('game.paused')}</h2>
              <div className="mt-6 flex flex-col gap-2">
                <Button variant="primary" onClick={() => gameRef.current?.resume()}>
                  {t('common.play')}
                </Button>
                {onExit && (
                  <Button variant="secondary" onClick={onExit}>
                    {t('game.home')}
                  </Button>
                )}
              </div>
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
