# Chitrakavyam Live Bidding Platform

Live art auction platform for IISER Kolkata Arts Club.

## What this project includes
- Node.js + Express backend with PostgreSQL
- React + Vite frontend
- Real-time updates with Socket.IO
- Admin panel for artworks, users, bids, config, and login fingerprints
- CSV import, image uploads, watchlist, anti-sniping logic, and audit logging

## System Requirements
- Linux (Arch, Ubuntu/Debian, Fedora tested paths below)
- Node.js 18+
- npm 9+
- PostgreSQL 14+

## 1. Install Dependencies (Linux)

### Arch Linux
```bash
sudo pacman -Syu
sudo pacman -S nodejs npm postgresql
```

### Ubuntu / Debian
```bash
sudo apt update
sudo apt install -y curl gnupg ca-certificates
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs postgresql postgresql-contrib
```

### Fedora
```bash
sudo dnf upgrade --refresh
sudo dnf install -y nodejs npm postgresql-server postgresql
```

## 2. Initialize PostgreSQL

### If using system PostgreSQL service

#### Arch Linux
```bash
sudo -u postgres initdb -D /var/lib/postgres/data
sudo systemctl enable --now postgresql
```

#### Ubuntu / Debian
Service is usually initialized automatically:
```bash
sudo systemctl enable --now postgresql
```

#### Fedora
```bash
sudo postgresql-setup --initdb
sudo systemctl enable --now postgresql
```

Verify:
```bash
pg_isready -h localhost -p 5432
```

### If you do not want system service (user-local PostgreSQL)
From project root:
```bash
mkdir -p .local-pg
initdb -D .local-pg
pg_ctl -D .local-pg -l .local-pg/postgres.log -o "-p 5432 -k $(pwd)/.local-pg" start
```

## 3. Create DB User, Database, and Privileges

Run as postgres superuser:
```bash
sudo -u postgres psql
```

Inside psql:
```sql
CREATE ROLE chitra_user WITH LOGIN PASSWORD 'change_me_strong_password';
CREATE DATABASE chitrakavyam OWNER chitra_user;
GRANT ALL PRIVILEGES ON DATABASE chitrakavyam TO chitra_user;
\c chitrakavyam
GRANT ALL ON SCHEMA public TO chitra_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO chitra_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO chitra_user;
```

If you are using your own Linux user instead of `chitra_user`, set the connection string accordingly.

## 4. Clone and Install Project
```bash
git clone <your-repo-url>
cd Art_Bid

cd server && npm install
cd ../client && npm install
cd ..
```

## 5. Configure Environment Files

### `server/.env`
Create from example:
```bash
cp server/.env.example server/.env
```

Recommended development content:
```env
DATABASE_URL=postgresql://chitra_user:change_me_strong_password@localhost:5432/chitrakavyam
JWT_SECRET=replace_with_long_random_secret_at_least_32_chars
PORT=3001
CLIENT_URLS=http://localhost:5173,http://<YOUR_LAN_IP>:5173
NODE_ENV=development
```

### `client/.env`
```bash
cp client/.env.example client/.env
```

```env
VITE_API_URL=/api
VITE_WS_URL=
```

## 6. Run Migrations
From project root:
```bash
psql "$DATABASE_URL" -f server/db/migrations/001_init.sql
psql "$DATABASE_URL" -f server/db/migrations/002_fix_auction_state_trigger.sql
psql "$DATABASE_URL" -f server/db/migrations/003_login_fingerprint.sql
psql "$DATABASE_URL" -f server/db/migrations/004_store_artwork_image_bytes.sql
```

If `DATABASE_URL` is not exported in shell:
```bash
psql -h localhost -U chitra_user -d chitrakavyam -f server/db/migrations/001_init.sql
psql -h localhost -U chitra_user -d chitrakavyam -f server/db/migrations/002_fix_auction_state_trigger.sql
psql -h localhost -U chitra_user -d chitrakavyam -f server/db/migrations/003_login_fingerprint.sql
psql -h localhost -U chitra_user -d chitrakavyam -f server/db/migrations/004_store_artwork_image_bytes.sql
```

### 6.1 Upgrade Existing Image Records (important on older deployments)
After migration `004_store_artwork_image_bytes.sql`, old rows that still point to `/uploads/...` should be migrated to PostgreSQL bytes.

- New uploads now use PostgreSQL-backed image content URLs automatically.
- Existing legacy rows can be migrated by calling admin endpoint: `POST /api/upload/images/backfill-legacy`.
- Optional body/query for that endpoint: `limit` (default 500, max 5000 per run).
- Repeat the endpoint call until response returns `scanned: 0`.

Verify progress:
```sql
SELECT COUNT(*) AS total_images,
			 COUNT(image_data) AS images_with_data,
			 COUNT(*) - COUNT(image_data) AS images_without_data
FROM artwork_images;
```

Note: legacy `/uploads/...` files must still exist at migration time to be converted.

## 7. Seed Sample Data (recommended for testing)
```bash
cd server
npm run seed:sample
```
This is a clean slate initialization script. It truncates existing database tables and creates the main admin account.

Default seeded accounts:
- Admin: `artmaster@iiserkol.ac.in` / `master001`

## 8. Start the Application

### Terminal 1 (backend)
```bash
cd server
npm run dev
```
Backend URL: `http://localhost:3001`

### Terminal 2 (frontend)
```bash
cd client
npm run dev -- --host 0.0.0.0 --port 5173
```
Frontend URLs:
- Local: `http://localhost:5173`
- Intranet: `http://<YOUR_LAN_IP>:5173`

## 9. Admin User Creation (manual method)
If you signed up normally and want to promote an account:
```sql
UPDATE users SET is_admin = TRUE WHERE email = 'yourname@iiserkol.ac.in';
```

## 10. Intranet Access Checklist
- Frontend must run with `--host 0.0.0.0`
- Backend `CLIENT_URLS` must include LAN URL
- Ports must be open in firewall

Example (ufw):
```bash
sudo ufw allow 3001/tcp
sudo ufw allow 5173/tcp
```

## 11. Useful Commands

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

### Frontend production build
```bash
cd client
npm run build
```

### Stop user-local PostgreSQL cluster
```bash
pg_ctl -D .local-pg stop
```

## API Summary

### Auth
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `PATCH /api/auth/profile`

### Public auction/artworks
- `GET /api/auction/config`
- `GET /api/artworks`
- `GET /api/artworks/:id`
- `GET /api/artworks/:id/bids`

### Bidding
- `POST /api/bids`
- `GET /api/bids/my`

### Watchlist
- `GET /api/watchlist`
- `POST /api/watchlist`
- `DELETE /api/watchlist/:artworkId`

### Admin
- `GET /api/admin/stats`
- `GET /api/admin/artworks`
- `GET /api/admin/bids`
- `DELETE /api/admin/bids/:id`
- `GET /api/admin/users`
- `PATCH /api/admin/users/:id`
- `GET /api/admin/logins`
- `GET /api/admin/config`
- `POST /api/admin/config`
- `GET /api/admin/winners`
- `GET /api/admin/audit`
- `POST /api/admin/import-csv`

## Troubleshooting

### `EADDRINUSE` on 3001 or 5173
Another process is using the port.
```bash
fuser -k 3001/tcp
fuser -k 5173/tcp
```

### CORS error from intranet device
- Confirm frontend URL is in `CLIENT_URLS`
- Restart backend after env changes

### Cookies not being set
- Ensure frontend calls backend with credentials enabled (already configured)
- Keep `NODE_ENV=development` for local non-https sessions

### PostgreSQL permission denied
Recheck owner/privileges for `chitra_user` and schema grants.

## Production Notes
- Build frontend and serve via backend static mode (`NODE_ENV=production`)
- Use reverse proxy (Nginx sample in `ops/nginx.chitrakavyam.conf`)
- Run periodic backups (`ops/backup_db.sh`)

## Render PostgreSQL to Supabase Migration (no secret commit flow)

This backend already uses PostgreSQL via `DATABASE_URL`, so moving to Supabase does not require code rewrites.

### 1. Collect required values (outside git)
- Source Render DB URL (full connection string)
- Destination Supabase DB URL (full connection string)
- Keep both in shell env only; do not write real values to tracked files

### 2. Run migration script with verification
From project root:
```bash
chmod +x ops/migrate_render_to_supabase.sh
SRC_DATABASE_URL='postgresql://render_user:***@render-host/render_db?sslmode=require' \
DEST_DATABASE_URL='postgresql://postgres.<project-ref>:***@aws-0-<region>.pooler.supabase.com:6543/postgres?sslmode=require' \
./ops/migrate_render_to_supabase.sh
```

What this script does:
- Creates a `pg_dump` custom-format backup from source
- Restores into destination using `pg_restore --clean --if-exists`
- Verifies row counts for all `public.*` tables
- Verifies sequence `last_value` snapshots

Artifacts are saved under `./tmp/db_migration_*` so you can audit before cutover.

### 3. Render UI environment variables (backend service)
Set these in Render dashboard for your backend service:

- `DATABASE_URL`: Supabase PostgreSQL URL (pooled or direct; include `sslmode=require`)
- `JWT_SECRET`: strong random secret
- `NODE_ENV`: `production`
- `CLIENT_URLS`: your frontend origin(s), comma separated
- `PG_POOL_MAX`: `35` (good baseline for ~100 concurrent users)
- `PG_IDLE_TIMEOUT_MS`: `30000`
- `PG_CONNECTION_TIMEOUT_MS`: `10000`
- `SIGNUP_RATE_LIMIT_MAX`: `20`
- `LOGIN_RATE_LIMIT_MAX`: `30`

Recommended Render policy:
- Enable "Auto-Deploy" only after migration verification passes
- Keep old Render DB untouched until production traffic is stable on Supabase

### 4. Secret-safe push checklist
- Confirm `.env`, `server/.env`, `client/.env` remain ignored
- Stage only intended source/docs files (do not use `git add .`)
- Run a pre-push scan:
```bash
git diff --cached | rg -n 'postgresql://|SUPABASE|JWT_SECRET|password|api[_-]?key|secret' || true
```
- Verify staged files list:
```bash
git diff --cached --name-only
```

## Credits
Developed by [Shuvam Banerji Seal](https://shuvam-banerji-seal.github.io/).
