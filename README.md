# Chitrakavyam Live Bidding Platform

Live art auction platform for IISER Kolkata Arts Club.

---

## Stack

- **Frontend:** React + Vite
- **Backend:** Node.js + Express
- **Database:** PostgreSQL
- **Realtime:** Socket.IO
- **Auth:** JWT in httpOnly cookie

---

## Core Features

- IISER-only signup/login (`@iiserkol.ac.in`)
- Live bidding with realtime updates
- Anti-sniping extension (adds 5 minutes if bid arrives near auction close)
- Watchlist + profile bid tracking
- Admin panel for:
  - artworks
  - users
  - bids (void + recalculate winner)
  - auction config (pause/resume)
  - login fingerprint logs
  - audit logs
  - CSV import
- Image storage in PostgreSQL (`BYTEA`) with legacy `/uploads` backfill support

---

## Repository Structure

```text
client/                 React app (Vite)
server/                 Express API + Socket.IO
server/db/migrations/   SQL migrations
tests/server/           Jest tests (backend)
client/tests/           Vitest tests (frontend)
ops/                    Deployment / ops scripts
```

---

## Prerequisites

- Node.js **18+**
- npm **9+**
- PostgreSQL **14+**
- Python 3 (only for optional ops scripts like local HTTPS cert generation)

---

## 1) Install Dependencies

From project root:

```bash
cd server && npm install
cd ../client && npm install
cd ..
```

---

## 2) Configure Environment

### Backend

```bash
cp server/.env.example server/.env
```

Minimum recommended values in `server/.env`:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/chitrakavyam
JWT_SECRET=replace_with_a_long_random_secret
PORT=3001
CLIENT_URLS=http://localhost:5173,http://YOUR_LAN_IP:5173
NODE_ENV=development
```

### Frontend

```bash
cp client/.env.example client/.env
```

```env
VITE_API_URL=/api
VITE_WS_URL=
```

---

## 3) Run Database Migrations

```bash
psql "$DATABASE_URL" -f server/db/migrations/001_init.sql
psql "$DATABASE_URL" -f server/db/migrations/002_fix_auction_state_trigger.sql
psql "$DATABASE_URL" -f server/db/migrations/003_login_fingerprint.sql
psql "$DATABASE_URL" -f server/db/migrations/004_store_artwork_image_bytes.sql
```

If `DATABASE_URL` is not exported, run with `-h/-U/-d` explicitly.

---

## 4) Optional: Seed Fresh Starter Data

> ⚠️ This resets existing data (truncate + restart identity).

```bash
cd server
npm run seed:sample
```

Default seeded admin:

- `artmaster@iiserkol.ac.in`
- `master001`

---

## 5) Run the App

### Manual (2 terminals)

**Terminal 1 (backend)**
```bash
cd server
npm run dev
```

**Terminal 2 (frontend)**
```bash
cd client
npm run dev -- --host 0.0.0.0 --port 5173
```

### One-command safe start (optional)

```bash
chmod +x ops/start_server_safe.sh
./ops/start_server_safe.sh
```

This script can:
- generate local HTTPS certs (if needed)
- start backend/frontend
- rotate logs
- write PID files

---

## Testing

### Backend tests

```bash
cd server
npm test
```

### Frontend tests

```bash
cd client
npm test
```

---

## Important API Groups

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/artworks`
- `GET /api/artworks/:id`
- `POST /api/bids`
- `GET /api/bids/my`
- `GET /api/watchlist`
- `POST /api/watchlist`
- `DELETE /api/watchlist/:artworkId`
- `GET /api/admin/stats`
- `GET /api/admin/artworks`
- `POST /api/admin/config`
- `POST /api/admin/import-csv`

---

## Legacy Image Backfill (if upgrading old data)

After migration `004_store_artwork_image_bytes.sql`, migrate legacy `/uploads/*` references into DB bytes:

```bash
curl -X POST http://localhost:3001/api/upload/images/backfill-legacy \
  -H "Content-Type: application/json" \
  -d '{"limit":500}'
```

Repeat until response reports `scanned: 0`.

---

## Ops Scripts

- `ops/backup_db.sh` — gzip PostgreSQL backups
- `ops/migrate_render_to_supabase.sh` — one-shot migration + verification
- `ops/start_noip_public.sh` — temporary public demo startup
- `ops/NOIP_SETUP.md` — No-IP setup guide
- `ops/nginx.chitrakavyam.conf` — reverse proxy sample

---

## Troubleshooting

### Port already in use

```bash
fuser -k 3001/tcp
fuser -k 5173/tcp
```

### CORS issues

- Ensure frontend origin is included in `CLIENT_URLS`
- Restart backend after env changes

### DB connection failures

- Verify PostgreSQL is running
- Verify `DATABASE_URL`
- Verify migrations were applied

---

## Security Notes

- Keep `.env` files out of git
- Do not commit real DB URLs or secrets
- CSRF protection uses cookie + header token on mutating requests
- Rate limits are enabled for auth and general API traffic

---

## Author

Developed by [Shuvam Banerji Seal](https://shuvam-banerji-seal.github.io/).
