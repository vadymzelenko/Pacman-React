'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useLang } from '@/lib/i18n';
import { Button, GlassCard, Logo } from '@/components/ui';
import Reveal from '@/components/Reveal';

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();
  const { t } = useLang();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const signIn = async (provider) => {
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Reveal className="mb-8 text-center">
          <Logo className="text-2xl" />
        </Reveal>
        <Reveal delay={0.1}>
          <GlassCard className="p-6">
            <h1 className="text-lg font-semibold text-ink">{t('login.title')}</h1>
            <p className="mt-2 text-sm text-muted">{t('login.subtitle')}</p>

            <div className="mt-6 flex flex-col gap-2">
              <Button variant="primary" onClick={() => signIn('google')} disabled={loading}>
                {t('login.google')}
              </Button>
              <Button variant="secondary" onClick={() => signIn('github')} disabled={loading}>
                {t('login.github')}
              </Button>
              <Button variant="ghost" onClick={() => router.push('/')} disabled={loading}>
                {t('login.back')}
              </Button>
            </div>
            {error && <p className="mt-4 text-sm text-danger">{error}</p>}
          </GlassCard>
        </Reveal>
      </div>
    </main>
  );
}
