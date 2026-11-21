# Grid Chomp

A minimalist arcade maze game in the spirit of Pac-Man. The player escapes the police through an endlessly generated maze, collects coins, buys cosmetics and boosts, and survives as long as possible, alone or in two-player co-op.

The repository contains the current version, `grid-chomp` (Next.js and Supabase), and the first version of the game (`client` and `server`, React with an Express and MongoDB backend).

## Grid Chomp

### Features

- **Endless maze:** deterministic chunked generation from a seed; connectivity is guaranteed by regularly spaced spine corridors with noise-based wall blocks between them
- **Grid movement** as in Pac-Man, with a camera that follows the player
- **Police AI:** A* pathfinding and dynamic off-screen spawning, so escapes cannot last forever
- **Single player:** survival with score, coins and rising difficulty
- **Co-op for two players:** host-authoritative simulation over Supabase Realtime, per-player coins, spectating after capture with a respawn after 7 seconds, team leaderboard; teammates become friends automatically
- **Economy:** coins buy skins, sound packs, music themes and single-use boosts (turbo, shield, coin magnet, police slow-down)
- **Procedural audio:** sound effects and background music generated with the Web Audio API
- **Accounts:** Google and GitHub sign-in, profiles, solo and co-op leaderboards, guest mode
- **Interface:** dark glass UI with Geist typography and Framer Motion, on-screen D-pad on mobile, English and Russian

### Stack

Next.js 16 (App Router), React 18, Supabase (Auth, Postgres with Row Level Security, Realtime), Tailwind CSS, Framer Motion, GSAP.

### Getting started

1. Create a Supabase project and run [`grid-chomp/supabase/schema.sql`](grid-chomp/supabase/schema.sql) in the SQL editor. It creates the tables, the shop catalogue, Row Level Security policies and the game functions.
2. Enable the Google and GitHub providers in Supabase Auth with the redirect URL `<site origin>/auth/callback`.
3. Run the app:

```bash
cd grid-chomp
cp .env.local.example .env.local   # Supabase URL and anon key
npm install
npm run dev                        # http://localhost:3000
```

### Controls

| Input | Action |
|---|---|
| Arrow keys or `W` `A` `S` `D` | Move |
| `Esc` or `P` | Pause |
| On-screen D-pad | Move on touch devices |

In co-op, the host creates a room and shares its 6-character code.

### Data model

| Table | Purpose |
|---|---|
| `profiles` | Username, coins, best and total score, best survival time, equipped items |
| `shop_items` | Catalogue with server-side prices |
| `user_items` | Owned items and boost quantities |
| `rooms`, `room_players` | Co-op rooms |
| `team_scores` | Co-op results |
| `friendships` | Friends list |

Coins, scores and purchases change only through `SECURITY DEFINER` functions (`add_score`, `add_coins`, `buy_item`, `consume_boost`, `save_coop_result`). Clients can update only their username and equipped items, and only items they own.

### Structure

```
grid-chomp/
├── app/              Pages: welcome, dashboard, game, multiplayer, leaderboard, store, settings, credits, login
├── components/       UI primitives, header, D-pad, game and co-op canvases, dashboard panels
├── game/             Maze generation, A*, single-player engine, co-op engine, Web Audio
├── lib/              Item catalogue, translations, preferences, Supabase client and session
└── supabase/         Database schema
```

## First version

`client` (React, Create React App, GSAP, PrimeReact) and `server` (Express, MongoDB with Mongoose, Passport with Google and GitHub OAuth, sessions) implement the original game with accounts, a store and a leaderboard.

```bash
cd server && cp .env.example .env && npm install && npm start
cd client && npm install && npm start
```

## License

[MIT](LICENSE) © Vadym Zelenko
