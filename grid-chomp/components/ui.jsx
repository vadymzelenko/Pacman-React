'use client';

import { motion } from 'framer-motion';

export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

export function Logo({ className }) {
  return (
    <span className={cn('font-pixel text-ink', className)}>
      GRID<span className="text-accent">CHOMP</span>
    </span>
  );
}

const BTN_BASE =
  'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors duration-150 ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ' +
  'disabled:pointer-events-none disabled:opacity-50 select-none';

const BTN_VARIANTS = {
  primary: 'bg-white text-black hover:bg-zinc-200',
  accent: 'bg-accent text-white hover:bg-accent-strong',
  secondary: 'glass text-ink hover:bg-white/10',
  ghost: 'text-muted hover:bg-white/5 hover:text-ink',
  danger: 'border border-danger/30 bg-danger/15 text-danger hover:bg-danger/25',
  coin: 'border border-coin/30 bg-coin/15 text-coin hover:bg-coin/25',
};

const BTN_SIZES = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

export function Button({ variant = 'secondary', size = 'md', className, children, ...props }) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      className={cn(BTN_BASE, BTN_VARIANTS[variant], BTN_SIZES[size], className)}
      {...props}
    >
      {children}
    </motion.button>
  );
}

export function GlassCard({ className, children, ...props }) {
  return (
    <div className={cn('glass rounded-2xl', className)} {...props}>
      {children}
    </div>
  );
}

export function Chip({ className, children }) {
  return (
    <span className={cn('glass inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-muted', className)}>
      {children}
    </span>
  );
}

export function Coin({ value, className }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 font-medium text-coin', className)}>
      <span className="inline-block h-2.5 w-2.5 rounded-full bg-coin shadow-[0_0_10px_rgba(245,197,24,0.6)]" />
      {value}
    </span>
  );
}

export function Spinner({ className }) {
  return <span className={cn('inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white', className)} />;
}
