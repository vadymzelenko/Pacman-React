'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@/lib/session';
import { useLang } from '@/lib/i18n';
import { Button, GlassCard, cn } from '@/components/ui';
import { getSkin, getBoost, itemType } from '@/lib/catalog';

const CATS = [
  { id: 'skin', key: 'store.skin' },
  { id: 'sound', key: 'store.sound' },
  { id: 'music', key: 'store.music' },
  { id: 'boost', key: 'store.boost' },
];

// Модульный кэш каталога магазина (грузится один раз за сессию).
let shopCache = null;

export default function StorePanel() {
  const { supabase, profile, inventory, setInventory, setProfile } = useSession();
  const { t } = useLang();
  const [cat, setCat] = useState('skin');
  const [items, setItems] = useState(shopCache || []);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (shopCache) return;
    supabase
      .from('shop_items')
      .select('*')
      .order('sort')
      .then(({ data }) => {
        shopCache = data || [];
        setItems(shopCache);
      });
  }, [supabase]);

  const ownedQty = (id) => inventory.find((o) => o.item_id === id)?.quantity || 0;
  const isOwned = (item) => item.price === 0 || ownedQty(item.id) > 0;

  const isEquipped = (item) => {
    const ty = itemType(item.id);
    if (ty === 'skin') return profile.equipped_skin === item.id;
    if (ty === 'sound') return profile.equipped_sound === item.id;
    if (ty === 'music') return profile.equipped_music === item.id;
    return false;
  };

  const buy = async (item) => {
    const qty = ownedQty(item.id);
    const { data, error } = await supabase.rpc('buy_item', { p_item_id: item.id });
    if (error) {
      setMsg(error.message.includes('insufficient') ? t('store.noCoins') : error.message);
      return;
    }
    setInventory([...inventory.filter((x) => x.item_id !== item.id), { item_id: item.id, quantity: qty + 1 }]);
    setProfile({ ...profile, coins: data });
    setMsg(t('store.bought'));
  };

  const equip = async (item) => {
    const ty = itemType(item.id);
    const patch = ty === 'skin' ? { equipped_skin: item.id } : ty === 'sound' ? { equipped_sound: item.id } : { equipped_music: item.id };
    await supabase.from('profiles').update(patch).eq('id', profile.id);
    setProfile({ ...profile, ...patch });
  };

  const swatch = (item) => {
    const ty = itemType(item.id);
    if (ty === 'skin') {
      const s = getSkin(item.id);
      return { background: s.player, boxShadow: `0 0 16px ${s.glow}55` };
    }
    if (ty === 'music') return { background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' };
    if (ty === 'boost') return { background: 'linear-gradient(135deg,#f59e0b,#f43f5e)' };
    return { background: 'linear-gradient(135deg,#10b981,#22d3ee)' };
  };

  const list = items.filter((i) => itemType(i.id) === cat);

  return (
    <GlassCard className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-pixel text-sm text-ink sm:text-base">{t('store.title')}</h2>
        <div className="flex items-center gap-2 text-sm text-muted">
          {t('store.balance')}:
          <span className="inline-flex items-center gap-1.5 font-medium text-coin">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-coin" />
            {profile.coins}
          </span>
        </div>
      </div>
      <p className="mt-1 text-xs text-muted">{t('store.coinsNote')}</p>

      <div className="mt-5 flex gap-1 overflow-x-auto no-scrollbar">
        {CATS.map((c) => (
          <button
            key={c.id}
            onClick={() => setCat(c.id)}
            className={cn(
              'whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition-colors',
              cat === c.id ? 'bg-white/10 text-ink' : 'text-muted hover:text-ink'
            )}
          >
            {t(c.key)}
          </button>
        ))}
      </div>

      {msg && <p className="mt-3 text-sm text-success">{msg}</p>}
      {cat === 'boost' && <p className="mt-3 text-xs text-muted">{t('store.boostNote')}</p>}

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {list.map((item) => {
          const ty = itemType(item.id);
          return (
            <div key={item.id} className="glass flex flex-col rounded-2xl p-4">
              <div className="mx-auto h-12 w-12 rounded-xl" style={swatch(item)} />
              <p className="mt-3 text-center text-sm font-medium text-ink">{item.name}</p>
              <p className="text-center text-[11px] uppercase tracking-wider text-muted">{t(`store.${ty}`)}</p>
              {ty === 'boost' && <p className="mt-1 text-center text-[11px] text-muted">{t(getBoost(item.id).descKey)}</p>}
              <p className="mt-2 text-center text-sm font-semibold text-coin">{item.price === 0 ? t('store.free') : item.price}</p>
              <div className="mt-3">
                {ty === 'boost' ? (
                  isOwned(item) ? (
                    <Button size="sm" className="w-full" disabled>
                      {t('store.owned')} · {ownedQty(item.id)}
                    </Button>
                  ) : (
                    <Button size="sm" variant="coin" className="w-full" onClick={() => buy(item)}>
                      {t('store.buy')}
                    </Button>
                  )
                ) : isEquipped(item) ? (
                  <Button size="sm" className="w-full" disabled>
                    {t('store.equipped')}
                  </Button>
                ) : isOwned(item) ? (
                  <Button size="sm" className="w-full" onClick={() => equip(item)}>
                    {t('store.equip')}
                  </Button>
                ) : (
                  <Button size="sm" variant="coin" className="w-full" onClick={() => buy(item)}>
                    {t('store.buy')}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
