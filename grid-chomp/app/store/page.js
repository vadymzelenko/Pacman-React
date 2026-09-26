'use client';

import { useRouter } from 'next/navigation';
import Shell from '@/components/Shell';
import { useSession } from '@/lib/session';
import { useLang } from '@/lib/i18n';
import StorePanel from '@/components/panels/StorePanel';

export default function StorePage() {
  const { profile, loading } = useSession();
  const router = useRouter();
  const { t } = useLang();

  if (loading) return <div className="flex min-h-[100dvh] items-center justify-center text-muted">{t('common.loading')}</div>;
  if (!profile) {
    router.replace('/login');
    return null;
  }

  return (
    <Shell>
      <div className="mx-auto max-w-5xl">
        <StorePanel />
      </div>
    </Shell>
  );
}
