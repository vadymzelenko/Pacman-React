'use client';

import { useRouter } from 'next/navigation';
import { useLang } from '@/lib/i18n';
import { Button, GlassCard, Logo } from '@/components/ui';
import Reveal from '@/components/Reveal';

export default function CreditsPage() {
  const router = useRouter();
  const { t } = useLang();

  const rows = [t('credits.design'), t('credits.engine'), t('credits.audio'), t('credits.font')];

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <Reveal className="mb-8 text-center">
          <Logo className="text-2xl" />
        </Reveal>
        <Reveal delay={0.1}>
          <GlassCard className="p-6 text-center">
            <h1 className="text-lg font-semibold text-ink">{t('credits.title')}</h1>
            <p className="mt-2 text-sm text-muted">{t('credits.subtitle')}</p>
            <ul className="mt-6 space-y-2 text-sm text-muted">
              {rows.map((r) => (
                <li key={r} className="border-b border-line/60 pb-2 last:border-0">
                  {r}
                </li>
              ))}
            </ul>
            <p className="mt-5 text-sm text-ink">{t('credits.thanks')}</p>
            <Button variant="secondary" className="mt-6 w-full" onClick={() => router.push('/')}>
              {t('common.back')}
            </Button>
          </GlassCard>
        </Reveal>
      </div>
    </main>
  );
}
