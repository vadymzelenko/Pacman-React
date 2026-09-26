'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLang } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { Logo, cn } from '@/components/ui';
import Reveal from '@/components/Reveal';

// Минимальная оболочка для второстепенных страниц: лого + язык + кнопка «назад».
export default function Shell({ children }) {
  const router = useRouter();
  const { lang, setLang } = useLang();
  const { profile } = useSession();
  const home = profile ? '/dashboard' : '/';

  return (
    <div className="min-h-[100dvh]">
      <header className="glass-strong sticky top-0 z-40 border-x-0 border-t-0">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href={home} className="text-lg" aria-label="Grid Chomp">
            <Logo />
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg glass p-0.5">
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
            <button onClick={() => router.push(home)} className="glass rounded-lg px-3 py-2 text-sm text-ink">
              ←
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6">
        <Reveal>{children}</Reveal>
      </main>
    </div>
  );
}
