'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useSession } from '@/lib/session';
import { useLang } from '@/lib/i18n';
import { GlassCard, Chip, Logo, cn } from '@/components/ui';
import SingleplayerPanel from '@/components/panels/SingleplayerPanel';
import MultiplayerPanel from '@/components/panels/MultiplayerPanel';
import LeaderboardPanel from '@/components/panels/LeaderboardPanel';
import ProfilePanel from '@/components/panels/ProfilePanel';
import SettingsPanel from '@/components/panels/SettingsPanel';
import StorePanel from '@/components/panels/StorePanel';

const TABS = [
  { id: 'singleplayer', key: 'dash.tab.singleplayer' },
  { id: 'multiplayer', key: 'dash.tab.multiplayer' },
  { id: 'leaderboard', key: 'dash.tab.leaderboard' },
  { id: 'profile', key: 'dash.tab.profile' },
  { id: 'settings', key: 'dash.tab.settings' },
  { id: 'store', key: 'dash.tab.store' },
];

function randomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function colorOf(name) {
  const colors = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#06b6d4', '#8b5cf6'];
  let h = 0;
  for (const ch of name || '') h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return colors[h % colors.length];
}

export default function DashboardPage() {
  const { supabase, profile, friends, loading, signOut } = useSession();
  const router = useRouter();
  const { lang, setLang, t } = useLang();
  const [tab, setTab] = useState('singleplayer');

  if (loading) {
    return <div className="flex min-h-[100dvh] items-center justify-center text-muted">{t('common.loading')}</div>;
  }

  if (!profile) {
    router.replace('/login');
    return null;
  }

  const invite = async () => {
    const c = randomCode();
    const seed = Math.floor(Math.random() * 2 ** 31);
    const { data: room } = await supabase.from('rooms').insert({ code: c, host_id: profile.id, seed }).select().single();
    if (room) await supabase.from('room_players').insert({ room_id: room.id, user_id: profile.id });
    try {
      await navigator.clipboard.writeText(c);
    } catch (e) {
      /* ignore */
    }
    router.push('/multiplayer/' + c);
  };

  const stats = [
    { label: t('dash.coins'), value: profile.coins || 0, coin: true },
    { label: t('dash.record'), value: profile.max_score || 0 },
    { label: t('dash.total'), value: profile.total_score || 0 },
    { label: t('dash.survival'), value: `${profile.max_survival || 0}s` },
  ];

  return (
    <div className="min-h-[100dvh]">
      <header className="glass-strong sticky top-0 z-40 border-x-0 border-t-0">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <button onClick={() => router.push('/')} className="shrink-0 text-lg" aria-label="Grid Chomp">
            <Logo />
          </button>

          <div className="flex items-center gap-2">
            <span className="glass inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium text-coin">
              <span className="inline-block h-2 w-2 rounded-full bg-coin" />
              {profile.coins || 0}
            </span>
            <div className="hidden items-center gap-0.5 rounded-lg glass p-0.5 sm:flex">
              {['ru', 'en'].map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={cn('rounded-md px-2 py-1 text-xs font-semibold uppercase transition-colors', lang === l ? 'bg-white/10 text-ink' : 'text-muted')}
                >
                  {l}
                </button>
              ))}
            </div>
            <button onClick={signOut} className="glass rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:text-ink">
              {t('nav.logout')}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6">
        {/* Профиль */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-semibold text-white" style={{ background: colorOf(profile.username) }}>
              {(profile.username || '?').slice(0, 1).toUpperCase()}
            </div>
            <div>
              <h1 className="font-pixel text-lg text-ink sm:text-xl">{profile.username}</h1>
              <p className="mt-1 text-sm text-muted">{t('dash.title')}</p>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {stats.map((s) => (
              <div key={s.label} className="glass rounded-2xl px-3 py-2 text-center sm:px-4">
                <div className="font-pixel text-[8px] text-muted">{s.label}</div>
                <div className={cn('mt-1 text-sm font-semibold tabular-nums', s.coin ? 'text-coin' : 'text-ink')}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Друзья */}
        <GlassCard className="mt-6 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-pixel text-xs text-ink">{t('dash.friends')}</h2>
            <Chip className="text-ink">{friends.length}</Chip>
          </div>
          {friends.length === 0 ? (
            <p className="mt-3 text-sm text-muted">{t('dash.noFriends')}</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {friends.map((f) => (
                <div key={f.id} className="glass flex items-center gap-2 rounded-xl px-3 py-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-semibold text-white" style={{ background: colorOf(f.username) }}>
                    {f.username.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="text-sm text-ink">{f.username}</span>
                </div>
              ))}
            </div>
          )}
          <button onClick={invite} className="mt-4 text-sm font-medium text-accent transition-colors hover:text-accent-strong">
            {t('dash.invite')} →
          </button>
        </GlassCard>

        {/* Вкладки */}
        <div className="no-scrollbar mt-6 flex gap-1 overflow-x-auto">
          {TABS.map((tb) => (
            <button
              key={tb.id}
              onClick={() => setTab(tb.id)}
              className={cn(
                'font-pixel whitespace-nowrap rounded-xl px-3 py-2 text-[10px] transition-colors',
                tab === tb.id ? 'bg-white/10 text-ink' : 'text-muted hover:text-ink'
              )}
            >
              {t(tb.key)}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="mt-4"
          >
            {tab === 'singleplayer' && <SingleplayerPanel />}
            {tab === 'multiplayer' && <MultiplayerPanel />}
            {tab === 'leaderboard' && <LeaderboardPanel />}
            {tab === 'profile' && <ProfilePanel />}
            {tab === 'settings' && <SettingsPanel />}
            {tab === 'store' && <StorePanel />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
