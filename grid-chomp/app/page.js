'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useLang } from '@/lib/i18n';
import { Button, Logo, cn } from '@/components/ui';
import Reveal from '@/components/Reveal';

export default function HomePage() {
  const router = useRouter();
  const supabase = createClient();
  const { lang, setLang, t } = useLang();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });
  }, [supabase]);

  return (
    <main className="relative flex min-h-[100dvh] flex-col items-center justify-center px-6 py-16">
      <div className="absolute right-4 top-4 flex rounded-xl glass p-1">
        {['ru', 'en'].map((l) => (
          <button
            key={l}
            onClick={() => setLang(l)}
            className={cn('rounded-lg px-2.5 py-1.5 text-xs font-semibold uppercase transition-colors', lang === l ? 'bg-white/10 text-ink' : 'text-muted')}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="flex w-full max-w-md flex-col items-center text-center">
        <Reveal>
          <div className="glass flex h-16 w-16 items-center justify-center rounded-2xl">
            <span className="h-8 w-8 rounded-full bg-accent" style={{ clipPath: 'polygon(50% 50%, 100% 0%, 100% 100%)' }} />
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <h1 className="mt-7 text-ink">
            <Logo className="text-3xl sm:text-5xl" />
          </h1>
        </Reveal>

        <Reveal delay={0.16}>
          <p className="mt-5 text-sm font-medium uppercase tracking-[0.3em] text-muted">{t('welcome.tagline')}</p>
        </Reveal>

        <Reveal delay={0.24}>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">{t('welcome.subtitle')}</p>
        </Reveal>

        <Reveal delay={0.32} className="mt-10 flex w-full max-w-xs flex-col gap-3">
          {!loading && user ? (
            <Button variant="primary" size="lg" onClick={() => router.push('/dashboard')}>
              {t('welcome.continue')} {user.user_metadata?.full_name || user.email?.split('@')[0]}
            </Button>
          ) : (
            <Button variant="primary" size="lg" onClick={() => router.push('/game')}>
              {t('welcome.playGuest')}
            </Button>
          )}
          {!loading && !user && (
            <Button variant="secondary" size="lg" onClick={() => router.push('/login')}>
              {t('welcome.login')}
            </Button>
          )}
          <div className="flex gap-3">
            <Button variant="ghost" className="flex-1" onClick={() => router.push('/settings')}>
              {t('welcome.settings')}
            </Button>
            <Button variant="ghost" className="flex-1" onClick={() => router.push('/credits')}>
              {t('welcome.credits')}
            </Button>
          </div>
        </Reveal>
      </div>
    </main>
  );
}
