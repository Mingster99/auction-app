# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Backend (Node.js/Express, runs on port 5000):
```bash
cd backend
npm install
npm run dev          # nodemon auto-reload
npm start            # production
```

Frontend (CRA + React 18, runs on port 3000):
```bash
cd frontend
npm install
npm start            # dev server
npm run build        # production bundle
npm test             # react-scripts test (currently no suites authored)
```

Database migrations are plain SQL files run manually in numeric order:
```bash
psql -d pokemon_auction -f backend/src/database/migrations/001_initial_schema.sql
# ...repeat through 013_add_invoice_shipping_and_admin.sql
```
There is no migration runner — when adding schema changes, create the next-numbered SQL file in `backend/src/database/migrations/` and use `IF NOT EXISTS` / idempotent `DO $$ ... $$` blocks so it can be re-applied safely.

Env files (`backend/.env`, `frontend/.env`) are required. Backend needs `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, and `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` / `LIVEKIT_WS_URL` for streaming. Frontend needs `REACT_APP_API_URL` and `REACT_APP_WS_URL` (both default to `http://localhost:5000`). The `.env.example` files still mention Agora/Daily.co — that's stale; the codebase has migrated to LiveKit.

## Architecture

This is a real-time livestream auction app for Pokémon cards. Three cross-cutting subsystems drive most architectural decisions: **server-authoritative auctions**, **LiveKit video**, and **a role-gated post-sale settlement pipeline**.

### Backend layout (`backend/src/`)
- `server.js` boots HTTP + Socket.IO and calls `recoverActiveAuctions()` on startup.
- `app.js` mounts feature modules under `/api/<feature>`.
- `modules/<feature>/` — each feature is `<feature>.routes.js` + `<feature>.controller.js` (+ optional `.service.js`). Modules: `auth`, `users`, `cards` (with `psa.routes.js` for the PSA grading API), `streams`, `bids`, `inventory`, `browse`, `seller`, `profile`, `invoices`, `admin`.
- `services/` — cross-module logic: `auctionService.js` (the authoritative auction state machine), `livekitService.js` (token minting), `psaService.js` (external PSA grading lookup).
- `websocket/socketHandler.js` — single Socket.IO entry point. Authenticates via the same JWT used for REST, then delegates auction commands (`place-bid`, `buyout`, `start-auction`, `end-auction-early`, `skip-card`) to `auctionService` and chat to its own room.
- `middleware/auth.middleware.js` puts `{ id, email, username }` on `req.user` from the JWT. **It does not load role flags** (`is_verified_seller`, `is_admin`, `has_payment_method`). The `seller` and `admin` modules each define their own `requireVerifiedSeller` / `requireAdmin` guards that do an extra DB read; mirror that pattern for any future role checks rather than expanding the global middleware.
- `config/database.js` exports a shared `pg.Pool` (max 20). Always use `pool.connect()` + `BEGIN/COMMIT` for any multi-statement operation that mutates auction state.

### Frontend layout (`frontend/src/`)
- `App.jsx` — all routes. `RequireVerifiedSeller` wraps `/dashboard`; `RequireAdmin` wraps `/admin`.
- `pages/` — top-level routed views. Notable: `LivestreamPage.jsx` (buyer view), `StreamHostPage.jsx` (seller broadcast control center), `DashboardPage.jsx` (seller hub with `dashboard/*Tab.jsx` children), `AdminReviewPage.jsx` (shipment review queue).
- `services/` — thin axios wrappers around `/api/*` endpoints; one file per backend module. `api.js` is the shared axios instance: it injects the JWT from `localStorage` and force-redirects to `/login` on any 401.
- `hooks/useWebSocket.js` — single hook owning the Socket.IO connection, auction state, chat, and bid/buyout actions. The page calls `joinAuction(streamId)` and consumes `auctionState`, `currentBid`, `auctionError`. The hook auto-joins both `stream-<id>` (chat) and `auction:<id>` (auction) rooms on connect.
- `hooks/useLiveKit.js` — wraps `livekit-client`. Permissions come from the token grants (`canPublish`), not a client-side role flag.
- `context/AuthContext.jsx` and `context/NotificationContext.jsx` — global providers in `App.jsx`.

### The auction subsystem (read this before touching auctions)

`backend/src/services/auctionService.js` is the **single source of truth** for auction state. The state machine lives in the `cards` table (`auction_status: idle → active → ended | sold`, plus `current_bid`, `current_bidder_id`, `auction_started_at`, `auction_ends_at`, `winner_id`). Bids are recorded in `bids`. Invoices are auto-created on a successful sale.

Hard rules to preserve when editing this service:
- **Server-authoritative timers.** The end time is `NOW() + INTERVAL '...'` set inside the DB transaction; the in-process `auctionTimers` Map is just a `setTimeout` that calls `endAuction(cardId)`. Never trust client-supplied timestamps.
- **Anti-snipe.** A bid placed within `ANTI_SNIPE_WINDOW` (30s) of the end extends `auction_ends_at` by `ANTI_SNIPE_EXTENSION` (30s) and reschedules the timer. Both the DB column and the timer must move together.
- **Concurrency.** Every state-mutating path (`startAuction`, `placeBid`, `executeBuyout`, `endAuction`, `endAuctionEarly`) opens a transaction and locks the card row with `SELECT ... FOR UPDATE OF c` before reading `auction_status`/`current_bid`. Don't add a code path that reads-then-writes without that lock.
- **Rate limit.** `lastBidTime` map enforces `BID_RATE_LIMIT_MS` (500ms) per user. It is in-process and resets on restart — adequate for one node, not for horizontal scaling.
- **Crash recovery.** `recoverActiveAuctions()` runs on boot and either (a) re-arms `setTimeout` for auctions whose `auction_ends_at` is in the future or (b) immediately calls `endAuction()` for ones that expired during downtime. If you add new auction-lifecycle fields, make sure recovery handles them.
- **Broadcast on commit.** All `broadcast*` calls in `socketHandler.js` happen *after* `COMMIT`. Don't move them before commit (clients would see state that may roll back) and don't put DB work after them (a thrown broadcast error would leak un-broadcast state).
- **Money math.** All fee splitting goes through `utils/fees.js::calculatePlatformFee()`. Never inline percentage math in routes.

Socket.IO room conventions: `user:<userId>` for personal notifications, `stream-<streamId>` for chat, `auction:<streamId>` for auction events. The auction broadcast helpers (`broadcastAuctionStart`, `broadcastNewBid`, `broadcastAuctionEnd`, `broadcastTimeExtension`, `broadcastAuctionState`) all target `auction:<streamId>` — keep that room name in sync if it ever changes.

### LiveKit streaming
`livekitService.js` mints two token shapes: `generateHostToken` (`canPublish: true`, `roomCreate: true`) and `generateViewerToken` (`canPublish: false`, `canSubscribe: true`). The room name persists on `streams.channel_name` (legacy column from the Agora era). Frontend does not have a separate "client role" — it uses whatever the token grants, and `useLiveKit` reflects that.

### Settlement / admin pipeline
`invoices` rows are created automatically by `auctionService` on a winning bid or buyout. Status flow: `pending → processing → paid → awaiting_review → shipped → released` (with `failed` / `refunded` branches). Migration 013 added shipping fields (`tracking_number`, `tracking_carrier`, `shipped_at`) and the human-in-the-loop admin review (`reviewed_by_id`, `review_notes`, `released_at`). The admin module gates this flow; sellers mark shipped via `MarkShippedModal`, admins approve/reject in `AdminReviewPage`.

### Database migration history is the de-facto schema doc
The `migrations/` folder is numbered and additive — read them in order to see how a column was introduced. Several columns have legacy names: `streams.channel_name` (originally Agora, now LiveKit room name), `bids.is_winning_bid` (renamed from `is_winning` in 009). The `transactions` table from migration 001 was superseded by `invoices` in migration 010 and is no longer written to.
