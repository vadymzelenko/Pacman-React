'use client';

import { cn } from '@/components/ui';

// Экранный D-pad для мобильных устройств.
export default function Dpad({ onDir, className }) {
  const press = (dir) => () => onDir && onDir(dir);
  const btn =
    'glass flex h-14 w-14 items-center justify-center rounded-xl text-lg text-ink active:bg-white/15 touch-none select-none';

  return (
    <div className={cn('grid grid-cols-3 grid-rows-3 gap-2', className)}>
      <button aria-label="up" onPointerDown={press('up')} className={cn(btn, 'col-start-2 row-start-1')}>
        ▲
      </button>
      <button aria-label="left" onPointerDown={press('left')} className={cn(btn, 'col-start-1 row-start-2')}>
        ◀
      </button>
      <button aria-label="right" onPointerDown={press('right')} className={cn(btn, 'col-start-3 row-start-2')}>
        ▶
      </button>
      <button aria-label="down" onPointerDown={press('down')} className={cn(btn, 'col-start-2 row-start-3')}>
        ▼
      </button>
    </div>
  );
}
