'use client';

import { useLang } from '@/lib/i18n';
import { usePrefs } from '@/lib/prefs';
import { GlassCard, cn } from '@/components/ui';

function Toggle({ on, onChange }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cn(
        'relative h-8 w-14 shrink-0 rounded-full border transition-colors duration-200',
        on ? 'border-accent bg-accent' : 'border-white/15 bg-white/5'
      )}
    >
      <span
        className={cn(
          'absolute left-1 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-white shadow-md transition-transform duration-200',
          on ? 'translate-x-6' : 'translate-x-0'
        )}
      />
    </button>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line/60 py-4 last:border-0">
      <span className="text-sm text-ink">{label}</span>
      {children}
    </div>
  );
}

export default function SettingsPanel() {
  const { lang, setLang, t } = useLang();
  const { sfx, music, setSfx, setMusic } = usePrefs();

  return (
    <GlassCard className="p-6">
      <h2 className="font-pixel text-sm text-ink sm:text-base">{t('settings.title')}</h2>

      <div className="mt-4">
        <Row label={t('settings.language')}>
          <div className="flex rounded-xl glass p-1">
            {['ru', 'en'].map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={cn(
                  'font-pixel rounded-lg px-3 py-1.5 text-[10px] uppercase transition-colors',
                  lang === l ? 'bg-white/10 text-ink' : 'text-muted'
                )}
              >
                {l}
              </button>
            ))}
          </div>
        </Row>

        <Row label={t('settings.sfx')}>
          <Toggle on={sfx} onChange={setSfx} />
        </Row>

        <Row label={t('settings.music')}>
          <Toggle on={music} onChange={setMusic} />
        </Row>
      </div>
    </GlassCard>
  );
}
