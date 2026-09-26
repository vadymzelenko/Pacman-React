'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@/lib/session';
import { useLang } from '@/lib/i18n';
import { GlassCard, Spinner, cn } from '@/components/ui';

const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// Модульный кэш: рейтинг грузится один раз за сессию, а не при каждом открытии вкладки.
let cache = null;

export default function LeaderboardPanel() {
  const { supabase } = useSession();
  const { t } = useLang();
  const [tab, setTab] = useState('solo');
  const [data, setData] = useState(cache || { solo: [], coop: [] });
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    if (cache) return;
    (async () => {
      const [{ data: s }, { data: c }] = await Promise.all([
        supabase.from('profiles').select('username, max_score, coins').order('max_score', { ascending: false }).limit(50),
        supabase.from('team_scores').select('*').order('score', { ascending: false }).limit(50),
      ]);
      cache = { solo: s || [], coop: c || [] };
      setData(cache);
      setLoading(false);
    })();
  }, [supabase]);

  const rank = (i) => (i === 0 ? 'text-coin' : i === 1 ? 'text-zinc-300' : i === 2 ? 'text-amber-600' : 'text-muted');

  return (
    <GlassCard className="p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-pixel text-sm text-ink sm:text-base">{t('lb.title')}</h2>
        <div className="flex rounded-xl glass p-1">
          {['solo', 'coop'].map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={cn('rounded-lg px-3 py-1.5 text-sm font-medium transition-colors', tab === k ? 'bg-white/10 text-ink' : 'text-muted')}
            >
              {k === 'solo' ? t('lb.solo') : t('lb.coop')}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-muted">
          <Spinner />
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          {tab === 'solo' ? (
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
                  <th className="py-2 pr-2">{t('lb.rank')}</th>
                  <th className="py-2 pr-2">{t('lb.player')}</th>
                  <th className="py-2 pr-2 text-right">{t('lb.record')}</th>
                  <th className="py-2 text-right">{t('lb.coins')}</th>
                </tr>
              </thead>
              <tbody>
                {data.solo.map((r, i) => (
                  <tr key={i} className="border-b border-line/60">
                    <td className={`py-2.5 pr-2 font-semibold ${rank(i)}`}>{i + 1}</td>
                    <td className="py-2.5 pr-2 text-ink">{r.username}</td>
                    <td className="py-2.5 pr-2 text-right tabular-nums text-ink">{r.max_score}</td>
                    <td className="py-2.5 text-right tabular-nums text-coin">{r.coins}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
                  <th className="py-2 pr-2">{t('lb.rank')}</th>
                  <th className="py-2 pr-2">{t('lb.team')}</th>
                  <th className="py-2 pr-2 text-right">{t('lb.record')}</th>
                  <th className="py-2 text-right">{t('lb.survived')}</th>
                </tr>
              </thead>
              <tbody>
                {data.coop.map((r, i) => (
                  <tr key={i} className="border-b border-line/60">
                    <td className={`py-2.5 pr-2 font-semibold ${rank(i)}`}>{i + 1}</td>
                    <td className="py-2.5 pr-2 text-ink">
                      {r.player_a_name} + {r.player_b_name}
                    </td>
                    <td className="py-2.5 pr-2 text-right tabular-nums text-ink">{r.score}</td>
                    <td className="py-2.5 text-right tabular-nums text-muted">{fmt(r.survived || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {((tab === 'solo' && data.solo.length === 0) || (tab === 'coop' && data.coop.length === 0)) && (
            <p className="py-10 text-center text-sm text-muted">{t('lb.empty')}</p>
          )}
        </div>
      )}
    </GlassCard>
  );
}
