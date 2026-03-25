# Chitrakavyam — Live Bidding Platform

Full-stack live auction platform for **IISER Kolkata Arts Club's Chitrakavyam art festival**. Restricted exclusively to `@iiserkol.ac.in` email holders.

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + Express |
| Database | PostgreSQL |
| Auth | JWT (HTTP-only cookies) + bcrypt |
| Real-time | Socket.io (WebSockets) |
| File Uploads | Multer (local storage) |
| Frontend | React + Vite |

## Project Structure

```
chitrakavyam/
├── server/          # Express backend
│   ├── db/          # Pool + SQL migrations
│   ├── routes/      # auth, artworks, bids, admin, upload
│   ├── middleware/  # JWT auth + adminGuard
│   ├── sockets/     # Socket.io bid handler
│   └── utils/       # CSV import + bid validator
├── client/          # React frontend
│   └── src/
│       ├── pages/   # Auth, Gallery, Artwork, Profile, Admin
│       ├── components/
│       ├── hooks/
│       ├── context/
│       └── styles/
└── uploads/         # Local image storage
```

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+

### 1. Database Setup

```bash
# Create database
psql -U postgres -c "CREATE DATABASE chitrakavyam;"

# Run migrations
psql -U postgres -d chitrakavyam < server/db/migrations/001_init.sql
```

### 2. Server Setup

```bash
cd server
cp .env.example .env
# Edit .env: set DATABASE_URL, JWT_SECRET

npm install
npm start         # production
npm run dev       # development (nodemon)
```

### 3. Client Setup

```bash
cd client
cp .env.example .env
# VITE_API_URL=/api (default, uses Vite proxy)

npm install
npm run dev       # development (http://localhost:5173)
npm run build     # production build → dist/
```

### 4. Production Deployment

```bash
# Build React frontend
cd client && npm run build

# The Express server serves /client/dist as static files in production
# Set NODE_ENV=production in server/.env

# PM2 process management
cd server
pm2 start index.js --name chitrakavyam
pm2 save && pm2 startup
```

## Environment Variables

### server/.env
```
DATABASE_URL=postgresql://postgres:password@localhost:5432/chitrakavyam
JWT_SECRET=your_very_long_random_secret_here_minimum_32_chars
PORT=3001
CLIENT_URL=http://localhost:5173
NODE_ENV=development
```

### client/.env
```
VITE_API_URL=/api
VITE_WS_URL=
```

## API Endpoints

### Auth
- `POST /api/auth/signup` — Register with @iiserkol.ac.in email
- `POST /api/auth/login` — Login (rate limited, lockout after 5 failures)
- `POST /api/auth/logout` — Clear session cookie
- `GET /api/auth/me` — Current user profile
- `PATCH /api/auth/profile` — Update profile

### Artworks
- `GET /api/artworks` — List artworks (with filters, sorting)
- `GET /api/artworks/:id` — Artwork details with images
- `GET /api/artworks/:id/bids` — Bid history (top 3 public, full for admin)
- `POST /api/artworks` — Create artwork (admin)
- `PATCH /api/artworks/:id` — Update artwork (admin)
- `DELETE /api/artworks/:id` — Soft-delete artwork (admin)

### Bids
- `POST /api/bids` — Place a bid (authenticated)
- `GET /api/bids/my` — User's bid history

### Admin (requires admin JWT)
- `GET /api/admin/stats` — Dashboard statistics
- `GET /api/admin/artworks` — All artworks including pending
- `GET /api/admin/bids` — Full bid log
- `DELETE /api/admin/bids/:id` — Void a bid (recalculates winner)
- `GET /api/admin/users` — User management
- `PATCH /api/admin/users/:id` — Ban/promote user
- `GET /api/admin/config` — Auction configuration
- `POST /api/admin/config` — Update auction config
- `GET /api/admin/winners` — Export winning bids
- `GET /api/admin/audit` — Admin audit log
- `POST /api/admin/import-csv` — Import Google Form CSV

### Upload (admin only)
- `POST /api/upload/artwork/:id/images` — Upload artwork images
- `DELETE /api/upload/images/:imageId` — Delete image
- `PATCH /api/upload/images/:imageId` — Set primary / reorder

## WebSocket Events

### Server → Client
| Event | Payload |
|---|---|
| `bid:new` | `{ artworkId, newAmount, bidderMasked, totalBids, timestamp }` |
| `bid:youOutbid` | `{ artworkId, artworkTitle }` (to displaced winner only) |
| `auction:pause` | `{ reason }` |
| `auction:resume` | `{}` |
| `auction:config` | `{ newEndTime, newMinIncrement }` |

### Client → Server
| Event | Payload |
|---|---|
| `subscribe:artwork` | `{ artworkId }` |
| `unsubscribe:artwork` | `{ artworkId }` |

## Key Features

- **@iiserkol.ac.in only** — Enforced at DB (CHECK constraint), API, and frontend
- **Live bidding** — WebSocket updates within ~100ms for all connected clients
- **Anti-sniping** — Last-minute bid (within 5 min of close) extends auction by 5 min
- **Bid confirmation modal** — Prevents accidental bids
- **Rate limiting** — Max 1 bid per user per artwork per 5 seconds
- **Brute-force protection** — Account lockout after 5 failed login attempts
- **Admin audit log** — Every admin action logged with timestamp
- **CSV import** — Bulk import from Google Form submissions
- **Winner export** — One-click CSV of all winning bids for payment collection
- **Soft deletes** — Artworks use `deleted_at` pattern, nothing permanently lost

## Creating the First Admin User

After signup, promote yourself to admin directly in PostgreSQL:

```sql
UPDATE users SET is_admin = TRUE WHERE email = 'your@iiserkol.ac.in';
```