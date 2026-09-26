'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { createClient } from './supabase/client';

// Единый источник данных сессии: профиль, инвентарь и друзья загружаются один раз
// и переиспользуются всеми вкладками/страницами (без повторных запросов к БД).
const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const supabase = createClient();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      const u = data.user;
      setUser(u);

      if (u) {
        const [{ data: prof }, { data: inv }, { data: fs }] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', u.id).single(),
          supabase.from('user_items').select('item_id, quantity').eq('user_id', u.id),
          supabase.from('friendships').select('friend_id').eq('user_id', u.id),
        ]);
        if (!active) return;
        setProfile(prof || {});
        setInventory(inv || []);
        const ids = (fs || []).map((f) => f.friend_id);
        if (ids.length) {
          const { data: profs } = await supabase.from('profiles').select('id, username').in('id', ids);
          if (active) setFriends(profs || []);
        } else {
          setFriends([]);
        }
      }

      setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setUser(s?.user || null);
      if (!s?.user) {
        setProfile(null);
        setInventory([]);
        setFriends([]);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  const refresh = useCallback(async () => {
    if (!user) return;
    const [{ data: prof }, { data: inv }, { data: fs }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('user_items').select('item_id, quantity').eq('user_id', user.id),
      supabase.from('friendships').select('friend_id').eq('user_id', user.id),
    ]);
    setProfile(prof || {});
    setInventory(inv || []);
    const ids = (fs || []).map((f) => f.friend_id);
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('id, username').in('id', ids);
      setFriends(profs || []);
    } else {
      setFriends([]);
    }
  }, [supabase, user]);

  const updateProfile = useCallback((p) => setProfile(p), []);
  const updateInventory = useCallback((i) => setInventory(i), []);

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  return (
    <SessionContext.Provider
      value={{ user, profile, inventory, friends, loading, refresh, setProfile: updateProfile, setInventory: updateInventory, signOut, supabase }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export const useSession = () => useContext(SessionContext);
