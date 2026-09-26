'use client';

import Shell from '@/components/Shell';
import SettingsPanel from '@/components/panels/SettingsPanel';

export default function SettingsPage() {
  return (
    <Shell>
      <div className="mx-auto max-w-xl">
        <SettingsPanel />
      </div>
    </Shell>
  );
}
