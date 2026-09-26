// Единый каталог предметов Grid Chomp.
// Цены дублируются в supabase/schema.sql (таблица shop_items) для серверной проверки.
// Все цвета и тембры — процедурные, без чужой интеллектуальной собственности.

export const SKINS = [
  { id: 'indigo',  name: 'Indigo',  price: 0,    player: '#6366f1', glow: '#818cf8' },
  { id: 'emerald', name: 'Emerald', price: 500,  player: '#10b981', glow: '#34d399' },
  { id: 'amber',   name: 'Amber',   price: 500,  player: '#f59e0b', glow: '#fbbf24' },
  { id: 'rose',    name: 'Rose',    price: 800,  player: '#f43f5e', glow: '#fb7185' },
  { id: 'cyan',    name: 'Cyan',    price: 800,  player: '#06b6d4', glow: '#22d3ee' },
  { id: 'violet',  name: 'Violet',  price: 1200, player: '#8b5cf6', glow: '#a78bfa' },
  { id: 'mono',    name: 'Mono',    price: 1500, player: '#e4e4e7', glow: '#ffffff' },
];

export const SOUND_PACKS = [
  { id: 'classic', name: 'Classic', price: 0,   wave: 'square',   base: 220, siren: 160 },
  { id: 'soft',    name: 'Soft',    price: 400, wave: 'sine',     base: 240, siren: 180 },
  { id: 'bass',    name: 'Bass',    price: 600, wave: 'triangle', base: 140, siren: 90 },
  { id: 'chip',    name: 'Chip',    price: 900, wave: 'square',   base: 320, siren: 240 },
];

export const MUSIC_THEMES = [
  { id: 'ambient', name: 'Ambient', price: 0,    scale: [0, 3, 7, 10], base: 130, tempo: 0.55, wave: 'sine' },
  { id: 'drive',   name: 'Drive',   price: 500,  scale: [0, 2, 7, 9],  base: 110, tempo: 0.9,  wave: 'square' },
  { id: 'night',   name: 'Night',   price: 700,  scale: [0, 3, 5, 7],  base: 98,  tempo: 0.7,  wave: 'triangle' },
  { id: 'uplift',  name: 'Uplift',  price: 1000, scale: [0, 4, 7, 11], base: 146, tempo: 1.0,  wave: 'sawtooth' },
];

// Бусты — расходники: покупаются в магазине, один активируется на забег.
export const BOOSTS = [
  { id: 'turbo',  name: 'Turbo',   price: 150, descKey: 'boost.turbo',  effect: { speed: 1.15 } },
  { id: 'shield', name: 'Shield',  price: 250, descKey: 'boost.shield', effect: { shield: 1 } },
  { id: 'magnet', name: 'Magnet',  price: 200, descKey: 'boost.magnet', effect: { magnet: 2 } },
  { id: 'slowmo', name: 'Slow-mo', price: 300, descKey: 'boost.slowmo', effect: { policeSlow: 0.85 } },
];

export const DEFAULT_SKIN = 'indigo';
export const DEFAULT_SOUND = 'classic';
export const DEFAULT_MUSIC = 'ambient';

export function getSkin(id) {
  return SKINS.find((s) => s.id === id) || SKINS[0];
}

export function getSoundPack(id) {
  return SOUND_PACKS.find((s) => s.id === id) || SOUND_PACKS[0];
}

export function getMusicTheme(id) {
  return MUSIC_THEMES.find((s) => s.id === id) || MUSIC_THEMES[0];
}

export function getBoost(id) {
  return BOOSTS.find((s) => s.id === id) || null;
}

export function getItem(id) {
  return (
    SKINS.find((s) => s.id === id) ||
    SOUND_PACKS.find((s) => s.id === id) ||
    MUSIC_THEMES.find((s) => s.id === id) ||
    BOOSTS.find((s) => s.id === id) ||
    null
  );
}

export function itemType(id) {
  if (SKINS.some((s) => s.id === id)) return 'skin';
  if (SOUND_PACKS.some((s) => s.id === id)) return 'sound';
  if (MUSIC_THEMES.some((s) => s.id === id)) return 'music';
  if (BOOSTS.some((s) => s.id === id)) return 'boost';
  return null;
}
