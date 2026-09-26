'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/session';
import { useLang } from '@/lib/i18n';
import { Button, GlassCard, Chip } from '@/components/ui';
import { getSkin, getSoundPack, getMusicTheme } from '@/lib/catalog';

export default function ProfilePanel() {
  const { supabase, profile, setProfile, signOut } = useSession();
  const router = useRouter();
  const { t } = useLang();
  const [username, setUsername] = useState(profile?.username || '');
  const [msg, setMsg] = useState('');
  const [confirm, setConfirm] = useState(false);

  const save = async () => {
    const clean = username.trim();
    if (!clean) return setMsg(t('dash.usernameEmpty'));
    if (clean.length > 12) return setMsg(t('dash.usernameLong'));
    const { error } = await supabase.from('profiles').update({ username: clean }).eq('id', profile.id);
    if (error) setMsg(String(error.message).includes('duplicate') ? t('dash.nameTaken') : error.message);
    else {
      setMsg(t('common.saved'));
      setProfile({ ...profile, username: clean });
    }
  };

  const removeAccount = async () => {
    await supabase.from('profiles').delete().eq('id', profile.id);
    await supabase.auth.signOut();
    router.push('/');
  };

  const skin = getSkin(profile.equipped_skin);
  const pack = getSoundPack(profile.equipped_sound);
  const theme = getMusicTheme(profile.equipped_music);

  return (
    <GlassCard className="p-6">
      <h2 className="font-pixel text-sm text-ink sm:text-base">{t('dash.tab.profile')}</h2>

      <div className="mt-6">
        <label className="text-sm font-medium text-ink">{t('dash.username')}</label>
        <div className="mt-2 flex gap-2">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={12}
            className="glass h-10 flex-1 rounded-xl px-3 text-sm text-ink outline-none focus:ring-2 focus:ring-accent/60"
          />
          <Button onClick={save}>{t('common.save')}</Button>
        </div>
        {msg && <p className="mt-2 text-xs text-success">{msg}</p>}
      </div>

      <div className="mt-7">
        <p className="text-sm font-medium text-ink">{t('dash.equipment')}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Chip className="text-ink">{t('dash.skin')} · {skin.name}</Chip>
          <Chip className="text-ink">{t('dash.sound')} · {pack.name}</Chip>
          <Chip className="text-ink">{t('dash.music')} · {theme.name}</Chip>
          <Button size="sm" variant="secondary" onClick={() => router.push('/store')}>
            {t('dash.shop')}
          </Button>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-2 border-t border-line pt-6">
        <Button variant="ghost" onClick={signOut}>
          {t('nav.logout')}
        </Button>
        {!confirm ? (
          <Button variant="danger" onClick={() => setConfirm(true)}>
            {t('dash.delete')}
          </Button>
        ) : (
          <div className="glass w-full rounded-2xl p-4">
            <p className="text-sm font-medium text-ink">{t('dash.deleteConfirm')}</p>
            <p className="mt-1 text-xs text-muted">{t('dash.deleteDesc')}</p>
            <div className="mt-3 flex gap-2">
              <Button variant="danger" onClick={removeAccount}>
                {t('dash.yes')}
              </Button>
              <Button variant="secondary" onClick={() => setConfirm(false)}>
                {t('common.cancel')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </GlassCard>
  );
}
