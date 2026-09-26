'use client';

import { createContext, useContext, useState } from 'react';

// Локальные настройки (звук/музыка) — localStorage, доступны игре и панели настроек.
const PrefsContext = createContext({ sfx: true, music: true, setSfx: () => {}, setMusic: () => {} });

export function PrefsProvider({ children }) {
  const [sfx, setSfx] = useState(() => {
    if (typeof window === 'undefined') return true;
    try {
      return localStorage.getItem('gc-sfx') !== '0';
    } catch (e) {
      return true;
    }
  });
  const [music, setMusic] = useState(() => {
    if (typeof window === 'undefined') return true;
    try {
      return localStorage.getItem('gc-music') !== '0';
    } catch (e) {
      return true;
    }
  });

  const changeSfx = (v) => {
    setSfx(v);
    try {
      localStorage.setItem('gc-sfx', v ? '1' : '0');
    } catch (e) {
      /* ignore */
    }
  };

  const changeMusic = (v) => {
    setMusic(v);
    try {
      localStorage.setItem('gc-music', v ? '1' : '0');
    } catch (e) {
      /* ignore */
    }
  };

  return (
    <PrefsContext.Provider value={{ sfx, music, setSfx: changeSfx, setMusic: changeMusic }}>
      {children}
    </PrefsContext.Provider>
  );
}

export const usePrefs = () => useContext(PrefsContext);
