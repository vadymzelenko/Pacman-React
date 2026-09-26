'use client';

import { useRouter } from 'next/navigation';
import { useLang } from '@/lib/i18n';
import { Button, Logo } from '@/components/ui';

export default function NotFound() {
  const router = useRouter();
  const { t } = useLang();

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center px-6">
      <Logo className="text-2xl" />
      <h1 className="mt-8 text-7xl font-bold text-ink">404</h1>
      <p className="mt-3 text-sm text-muted">{t('notFound.title')}</p>
      <Button variant="primary" className="mt-8" onClick={() => router.push('/')}>
        {t('notFound.back')}
      </Button>
    </main>
  );
}
