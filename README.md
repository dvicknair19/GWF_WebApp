# Gray Wolf Financial - Vendor Profile Generator (V1)

## Overview
A web application to automate vendor profile report generation using Claude AI and Python-based Word document generation.

## Tech Stack
- **Frontend**: React (Vite) + Tailwind CSS
- **Backend**: Node.js + Express
- **Microservice**: Python (Flask) + python-docx
- **Database**: Supabase (PostgreSQL)

## Prerequisites
- Node.js 18+
- Python 3.9+
- Supabase Account

## Local Development

### 1. Database Setup
1. Create a new Supabase project.
2. Go to the SQL Editor and run the contents of `database/schema.sql`.
3. Get your `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (Settings > API).

### 2. Environment Configuration
Copy the example environment files and fill in your credentials:

```bash
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
cp python-microservice/.env.example python-microservice/.env
```

**Required Keys:**
- `CLAUDE_API_KEY`: Your Anthropic API key.
- `SUPABASE_...`: Your Supabase credentials.

### 3. Install Dependencies

Install everything from the repo root:

```bash
npm run install:all
```

Or manually per service:

```bash
cd frontend && npm install
cd backend && npm install
cd python-microservice && pip install -r requirements.txt
```

### 4. Start All Services

From the repo root (starts all 3 services with labeled output):

```bash
npm run dev
```

Or start individually in separate terminals:

```bash
# Terminal 1 - Python Microservice (port 5050)
cd python-microservice && python app.py

# Terminal 2 - Backend API (port 3001)
cd backend && node server.js

# Terminal 3 - Frontend (port 5173)
cd frontend && npm run dev
```

Visit `http://localhost:5173` to use the app.

---

## Railway Deployment

### Architecture
```
Railway Project
├── Service: backend   (Node API + serves built React frontend)
└── Service: python    (Flask microservice)
```

The frontend is **not** a separate Railway service. It is built during the backend's build step and served as static files by Express in production.

### Step 1 — Push to GitHub
```bash
git add .
git commit -m "feat: Railway deployment configuration"
git push origin main
```

### Step 2 — Create Railway project
Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub repo → select this repo.

### Step 3 — Configure the Backend service

> **Important:** Railway will auto-detect Node.js from the root `package.json`. The `backend/railway.json` overrides this with custom build/start commands that handle both frontend and backend from the repo root.

In service settings:
- **Root Directory: `/` (repo root — NOT `/backend`)**
  This is required so the build command can access both `frontend/` and `backend/` directories.

The build sequence (defined in `backend/railway.json`):
1. `cd frontend` — enter frontend directory
2. `npm install` — install frontend dependencies
3. `npm run build` — build React app → outputs to `frontend/dist/`
4. `cd ..` — return to repo root
5. `mv frontend/dist backend/public` — move built frontend into backend
6. `cd backend && npm install` — install backend dependencies

**Environment variables to set on the backend service:**

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `CLAUDE_API_KEY` | `sk-ant-...` |
| `SUPABASE_URL` | `https://your-project.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | `your_service_role_key` |
| `PYTHON_SERVICE_URL` | `http://python.railway.internal:5050` |
| `CORS_ORIGIN` | *(set after you get your Railway domain — see Step 5)* |
| `VITE_API_URL` | *(set after you get your Railway domain — see Step 5)* |

> **Why `VITE_API_URL` on the backend service?** Vite bakes `import.meta.env.VITE_*` into the JS bundle at build time. Railway needs this var available during the build step so the frontend knows where the API lives in production.

### Step 4 — Configure the Python service

In same Railway project → New Service → GitHub (same repo).

- **Root Directory: `/python-microservice`**

No extra environment variables needed — the Flask app reads `PORT` from Railway automatically, and the template files are auto-detected from `./templates/`.

### Step 5 — Get your domain and finalize env vars

1. Backend service → Settings → Networking → Generate domain (e.g., `backend-prod.railway.app`)
2. Set these two vars on the **backend service**:
   - `CORS_ORIGIN=https://backend-prod.railway.app`
   - `VITE_API_URL=https://backend-prod.railway.app/api`
3. **Redeploy** the backend so it rebuilds the frontend bundle with the correct API URL.

### Step 6 — Verify
- `https://your-backend.railway.app` → React app loads
- `https://your-backend.railway.app/health` → `{"status":"healthy"}`
- `https://your-backend.railway.app/api/...` → API routes work

---

## Features
- **Login**: Email/password authentication via Supabase.
- **Generate Profile**: Input vendor details → fetch research → generate Word doc.
- **History**: View and regenerate past profiles.
- **Caching**: Research data is cached for 7 days to save API costs.
