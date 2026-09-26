import { createClient } from '@supabase/supabase-js';

// Надёжное сохранение очков при выходе/закрытии (sendBeacon).
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response('bad request', { status: 400 });
  }

  const { token, score, level, coins } = body || {};
  if (!token || typeof score !== 'number') {
    return new Response('bad request', { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const { data } = await supabase.auth.getUser();
  if (!data.user) return new Response('unauthorized', { status: 401 });

  await supabase.rpc('add_score', {
    p_score: Math.max(0, Math.floor(score)),
    p_level: Math.max(1, Math.floor(level || 1)),
    p_coins: Math.max(0, Math.floor(coins || 0)),
  });

  return new Response('ok', { status: 200 });
}
