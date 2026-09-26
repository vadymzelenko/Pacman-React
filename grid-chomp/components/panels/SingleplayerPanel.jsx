'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLang } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { Button, GlassCard, Chip, cn } from '@/components/ui';
import { BOOSTS, getBoost, getSkin, getSoundPack, getMusicTheme } from '@/lib/catalog';

export default function SingleplayerPanel() {
  const router = useRouter();
  const { t } = useLang();
  const { profile, inventory } = useSession();
  const [boost, setBoost] = useState(null);

  const boosts = (inventory || []).filter((r) => BOOSTS.some((b) => b.id === r.item_id) && r.quantity > 0);
  const skin = getSkin(profile?.equipped_skin);
  const pack = getSoundPack(profile?.equipped_sound);
  const theme = getMusicTheme(profile?.equipped_music);

  const play = () => router.push(boost ? `/game?boost=${boost}` : '/game');

  return (
    <GlassCard className="p-6">
      <h2 className="font-pixel text-sm text-ink sm:text-base">{t('dash.tab.singleplayer')}</h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">{t('welcome.subtitle')}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Chip className="text-ink">{t('dash.skin')} · {skin.name}</Chip>
        <Chip className="text-ink">{t('dash.sound')} · {pack.name}</Chip>
        <Chip className="text-ink">{t('dash.music')} · {theme.name}</Chip>
      </div>

      {boosts.length > 0 && (
        <div className="mt-6">
          <p className="text-sm font-medium text-ink">{t('game.selectBoost')}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => setBoost(null)}
              className={cn(
                'rounded-xl border px-3 py-2 text-sm transition-colors',
                !boost ? 'border-accent bg-accent/15 text-ink' : 'border-line text-muted hover:text-ink'
              )}
            >
              {t('game.noBoost')}
            </button>
            {boosts.map((b) => (
              <button
                key={b.item_id}
                onClick={() => setBoost(b.item_id)}
                className={cn(
                  'rounded-xl border px-3 py-2 text-sm transition-colors',
                  boost === b.item_id ? 'border-accent bg-accent/15 text-ink' : 'border-line text-muted hover:text-ink'
                )}
              >
                {getBoost(b.item_id).name} · {b.quantity}
              </button>
            ))}
          </div>
          {boost && <p className="mt-2 text-xs text-muted">{t(getBoost(boost).descKey)}</p>}
        </div>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        <Button variant="primary" size="lg" onClick={play}>
          {t('common.play')}
        </Button>
        <Button variant="secondary" size="lg" onClick={() => router.push('/store')}>
          {t('dash.shop')}
        </Button>
      </div>
    </GlassCard>
  );
}
