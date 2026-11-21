-- Grid Chomp database schema for Supabase.
-- Run once in the Supabase SQL editor. Safe to re-run: objects are created if missing
-- and functions are replaced.
--
-- Clients may read public data and change only harmless profile fields. Everything that
-- touches coins, scores or inventory goes through the SECURITY DEFINER functions below,
-- which act on auth.uid() and validate their input.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  username       text unique check (username is null or char_length(username) between 2 and 24),
  coins          integer not null default 0 check (coins >= 0),
  max_score      integer not null default 0,
  total_score    bigint  not null default 0,
  max_survival   integer not null default 0,           -- seconds
  equipped_skin  text    not null default 'indigo',
  equipped_sound text    not null default 'classic',
  equipped_music text    not null default 'ambient',
  created_at     timestamptz not null default now()
);

-- Prices are duplicated in lib/catalog.js for the UI; the server trusts this table.
create table if not exists public.shop_items (
  id    text primary key,
  name  text not null,
  type  text not null check (type in ('skin', 'sound', 'music', 'boost')),
  price integer not null check (price >= 0),
  sort  integer not null default 0
);

create table if not exists public.user_items (
  user_id  uuid not null references public.profiles (id) on delete cascade,
  item_id  text not null references public.shop_items (id),
  quantity integer not null default 1 check (quantity >= 0),
  primary key (user_id, item_id)
);

create table if not exists public.friendships (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  friend_id  uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

create table if not exists public.rooms (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  host_id    uuid not null references public.profiles (id) on delete cascade,
  seed       bigint not null,
  status     text not null default 'waiting' check (status in ('waiting', 'playing', 'finished')),
  created_at timestamptz not null default now()
);

create table if not exists public.room_players (
  room_id   uuid not null references public.rooms (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table if not exists public.team_scores (
  id            uuid primary key default gen_random_uuid(),
  room_id       uuid unique references public.rooms (id) on delete set null,
  player_a      uuid references public.profiles (id) on delete set null,
  player_b      uuid references public.profiles (id) on delete set null,
  player_a_name text,
  player_b_name text,
  score         integer not null,
  survived      integer not null default 0,            -- seconds
  created_at    timestamptz not null default now()
);

create index if not exists profiles_max_score_idx on public.profiles (max_score desc);
create index if not exists team_scores_score_idx  on public.team_scores (score desc);

-- ---------------------------------------------------------------------------
-- Catalogue (keep in sync with lib/catalog.js)
-- ---------------------------------------------------------------------------

insert into public.shop_items (id, name, type, price, sort) values
  ('indigo',  'Indigo',  'skin',  0,    10),
  ('emerald', 'Emerald', 'skin',  500,  11),
  ('amber',   'Amber',   'skin',  500,  12),
  ('rose',    'Rose',    'skin',  800,  13),
  ('cyan',    'Cyan',    'skin',  800,  14),
  ('violet',  'Violet',  'skin',  1200, 15),
  ('mono',    'Mono',    'skin',  1500, 16),
  ('classic', 'Classic', 'sound', 0,    20),
  ('soft',    'Soft',    'sound', 400,  21),
  ('bass',    'Bass',    'sound', 600,  22),
  ('chip',    'Chip',    'sound', 900,  23),
  ('ambient', 'Ambient', 'music', 0,    30),
  ('drive',   'Drive',   'music', 500,  31),
  ('night',   'Night',   'music', 700,  32),
  ('uplift',  'Uplift',  'music', 1000, 33),
  ('turbo',   'Turbo',   'boost', 150,  40),
  ('magnet',  'Magnet',  'boost', 200,  41),
  ('shield',  'Shield',  'boost', 250,  42),
  ('slowmo',  'Slow-mo', 'boost', 300,  43)
on conflict (id) do update
  set name = excluded.name, type = excluded.type, price = excluded.price, sort = excluded.sort;

-- ---------------------------------------------------------------------------
-- New users get a profile automatically
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'user_name',
                  new.raw_user_meta_data ->> 'name',
                  split_part(new.email, '@', 1)), 24)
  )
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Equipped items must be free or owned.
create or replace function public.check_equipped_items()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_item text;
begin
  foreach v_item in array array[new.equipped_skin, new.equipped_sound, new.equipped_music] loop
    if not exists (select 1 from shop_items s where s.id = v_item and s.price = 0)
       and not exists (select 1 from user_items u where u.user_id = new.id and u.item_id = v_item) then
      raise exception 'Item % is not owned', v_item;
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists profiles_check_equipped on public.profiles;
create trigger profiles_check_equipped
  before update of equipped_skin, equipped_sound, equipped_music on public.profiles
  for each row execute function public.check_equipped_items();

-- ---------------------------------------------------------------------------
-- Game functions (called with supabase.rpc)
-- ---------------------------------------------------------------------------

-- Single-player result. Values are clamped to keep obviously forged requests harmless.
create or replace function public.add_score(p_score integer, p_level integer default 1,
                                            p_coins integer default 0, p_survived integer default 0)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_score    integer := least(greatest(coalesce(p_score, 0), 0), 1000000);
  v_coins    integer := least(greatest(coalesce(p_coins, 0), 0), 5000);
  v_survived integer := least(greatest(coalesce(p_survived, 0), 0), 86400);
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  update profiles
     set coins        = coins + v_coins,
         total_score  = total_score + v_score,
         max_score    = greatest(max_score, v_score),
         max_survival = greatest(max_survival, v_survived)
   where id = auth.uid();
end;
$$;

-- Coins collected in a co-op run. Returns the new balance.
create or replace function public.add_coins(p_coins integer)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_balance integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  update profiles
     set coins = coins + least(greatest(coalesce(p_coins, 0), 0), 5000)
   where id = auth.uid()
  returning coins into v_balance;
  return v_balance;
end;
$$;

-- Buys an item. Skins, sounds and music are bought once; boosts stack.
-- Returns the new coin balance.
create or replace function public.buy_item(p_item_id text)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_item    shop_items%rowtype;
  v_balance integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_item from shop_items where id = p_item_id;
  if not found then
    raise exception 'Unknown item';
  end if;

  if v_item.type <> 'boost' and exists (
    select 1 from user_items where user_id = auth.uid() and item_id = p_item_id
  ) then
    raise exception 'Already owned';
  end if;

  update profiles
     set coins = coins - v_item.price
   where id = auth.uid() and coins >= v_item.price
  returning coins into v_balance;

  if v_balance is null then
    raise exception 'Not enough coins';
  end if;

  insert into user_items (user_id, item_id, quantity)
  values (auth.uid(), p_item_id, 1)
  on conflict (user_id, item_id) do update set quantity = user_items.quantity + 1;

  return v_balance;
end;
$$;

-- Uses one boost at the start of a run. Returns the remaining quantity.
create or replace function public.consume_boost(p_item_id text)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_left integer;
begin
  update user_items
     set quantity = quantity - 1
   where user_id = auth.uid() and item_id = p_item_id and quantity > 0
  returning quantity into v_left;

  if v_left is null then
    raise exception 'No boost left';
  end if;
  return v_left;
end;
$$;

-- Co-op result, written once per room by the host. Also links the two players as friends.
create or replace function public.save_coop_result(p_room_id uuid, p_score integer, p_survived integer default 0)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_room    rooms%rowtype;
  v_players uuid[];
begin
  select * into v_room from rooms where id = p_room_id;
  if not found or v_room.host_id <> auth.uid() then
    raise exception 'Only the host can save the result';
  end if;

  select array_agg(user_id order by joined_at) into v_players
    from room_players where room_id = p_room_id;

  insert into team_scores (room_id, player_a, player_b, player_a_name, player_b_name, score, survived)
  values (
    p_room_id,
    v_players[1],
    v_players[2],
    (select username from profiles where id = v_players[1]),
    (select username from profiles where id = v_players[2]),
    least(greatest(coalesce(p_score, 0), 0), 1000000),
    least(greatest(coalesce(p_survived, 0), 0), 86400)
  )
  on conflict (room_id) do nothing;

  -- Teammates become friends automatically.
  if v_players[2] is not null then
    insert into friendships (user_id, friend_id)
    values (v_players[1], v_players[2]), (v_players[2], v_players[1])
    on conflict do nothing;
  end if;

  update rooms set status = 'finished' where id = p_room_id;
end;
$$;

revoke all on function public.add_score(integer, integer, integer, integer) from public, anon;
revoke all on function public.add_coins(integer)                            from public, anon;
revoke all on function public.buy_item(text)                                from public, anon;
revoke all on function public.consume_boost(text)                           from public, anon;
revoke all on function public.save_coop_result(uuid, integer, integer)      from public, anon;
grant execute on function public.add_score(integer, integer, integer, integer) to authenticated;
grant execute on function public.add_coins(integer)                            to authenticated;
grant execute on function public.buy_item(text)                                to authenticated;
grant execute on function public.consume_boost(text)                           to authenticated;
grant execute on function public.save_coop_result(uuid, integer, integer)      to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles     enable row level security;
alter table public.shop_items   enable row level security;
alter table public.user_items   enable row level security;
alter table public.friendships  enable row level security;
alter table public.rooms        enable row level security;
alter table public.room_players enable row level security;
alter table public.team_scores  enable row level security;

-- Profiles: public read (leaderboard); users edit only cosmetic fields of their own row.
drop policy if exists "profiles are public" on public.profiles;
create policy "profiles are public" on public.profiles for select using (true);
drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile" on public.profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "users delete own profile" on public.profiles;
create policy "users delete own profile" on public.profiles for delete using (auth.uid() = id);

revoke update on public.profiles from anon, authenticated;
grant update (username, equipped_skin, equipped_sound, equipped_music) on public.profiles to authenticated;

drop policy if exists "shop is public" on public.shop_items;
create policy "shop is public" on public.shop_items for select using (true);

drop policy if exists "users read own items" on public.user_items;
create policy "users read own items" on public.user_items for select using (auth.uid() = user_id);

drop policy if exists "users read own friendships" on public.friendships;
create policy "users read own friendships" on public.friendships for select using (auth.uid() = user_id);
drop policy if exists "users add friends" on public.friendships;
create policy "users add friends" on public.friendships for insert with check (auth.uid() = user_id);
drop policy if exists "users remove friends" on public.friendships;
create policy "users remove friends" on public.friendships for delete using (auth.uid() = user_id);

-- Rooms are found by their short code, so signed-in players can read them.
drop policy if exists "signed-in users read rooms" on public.rooms;
create policy "signed-in users read rooms" on public.rooms for select using (auth.role() = 'authenticated');
drop policy if exists "users create own rooms" on public.rooms;
create policy "users create own rooms" on public.rooms for insert with check (auth.uid() = host_id);
drop policy if exists "hosts update rooms" on public.rooms;
create policy "hosts update rooms" on public.rooms for update using (auth.uid() = host_id);

drop policy if exists "signed-in users read room players" on public.room_players;
create policy "signed-in users read room players" on public.room_players for select using (auth.role() = 'authenticated');
drop policy if exists "users join rooms" on public.room_players;
create policy "users join rooms" on public.room_players for insert with check (auth.uid() = user_id);
drop policy if exists "users rejoin rooms" on public.room_players;
create policy "users rejoin rooms" on public.room_players for update using (auth.uid() = user_id);

drop policy if exists "team scores are public" on public.team_scores;
create policy "team scores are public" on public.team_scores for select using (true);
