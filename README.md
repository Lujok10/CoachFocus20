# Focus20 AI Deployment Coach — Vite + Google Calendar Backend

This build starts the next production layer for Focus20:

- React + Vite frontend
- Express backend API
- Prisma schema for PostgreSQL
- Google OAuth 2.0 calendar connection
- Google Calendar free/busy lookup
- Real calendar event write-back for Focus 20 blocks
- ActionsLog undo route that deletes the Google Calendar event and cancels the block
- Feedback / voice check-in route
- Backend analytics event recording
- LocalStorage fallback if the backend is not running

## 0. Use Node 20 LTS recommended

This build pins Prisma to `6.19.0` so the existing `schema.prisma` format works. Node 20 LTS is recommended. Node 24 may work, but Prisma support is more stable on Node 20.

Check your version:

```bash
node -v
```

## 1. Install dependencies

```bash
npm install
```

## 2. Copy environment file

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

## 3. Start Postgres locally

Docker option:

```bash
docker compose up -d
```

Or use your own PostgreSQL database and update `DATABASE_URL` in `.env`.

## 4. Prepare Prisma

```bash
npm run prisma:generate
npm run prisma:migrate
```

When prompted, name the migration something like:

```text
init_focus20
```

## 5. Create Google OAuth credentials

In Google Cloud Console:

1. Create/select a project.
2. Enable **Google Calendar API**.
3. Go to **APIs & Services > Credentials**.
4. Create **OAuth client ID**.
5. Application type: **Web application**.
6. Authorized JavaScript origin:

```text
http://localhost:5173
http://localhost:5174
```

Vite uses `5173` by default. If `5173` is already busy, it may move to `5174`. Add both origins in Google Cloud while developing.

7. Authorized redirect URI:

```text
http://localhost:8787/api/auth/google/callback
```

8. Copy the client ID and secret into `.env`:

```env
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
GOOGLE_REDIRECT_URI="http://localhost:8787/api/auth/google/callback"
```

## 6. Run the full app

```bash
npm run dev:full
```

Frontend:

```text
http://localhost:5173
# or http://localhost:5174 if Vite says 5173 is in use
```

Backend:

```text
http://localhost:8787/api/health
```

## 7. Connect Google Calendar

Open the app, go to **Settings > Google Calendar OAuth > Connect**.

After Google redirects back, Focus20 can:

- read free/busy slots
- silently create one Focus 20 block
- avoid duplicate blocks for the same day
- log every reservation action
- undo by deleting the Google Calendar event

## Important notes

## v1.3 fixes included

- Pinned Prisma and `@prisma/client` to `6.19.0` to avoid Prisma 7 datasource config errors.
- Fixed Prisma JSON payload typing for analytics events.
- Fixed voice check-in foreign key crash by creating/refreshing a real FocusBlock when the frontend sends a stale local/mock block ID.
- Allowed localhost dev origins when Vite moves from port `5173` to `5174`.

This is a development implementation. Before production, add:

- real user authentication instead of the demo user
- encrypted token storage
- production session handling
- Microsoft Graph connector
- deployment environment variables
- stronger audit views and admin observability
# CoachFocus20
