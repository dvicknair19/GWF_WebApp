# GWF WebApp — Project Context
**Last Updated:** 2026-02-17 (evening)
**Owner:** David
**Company:** Gray Wolf Financial (GWF) — vendor-agnostic consulting firm

---

## What This App Does

GWF WebApp is an internal tool for Gray Wolf Financial that automates the creation of vendor profile documents used in Master Services Agreement (MSA) negotiations.

**Core workflow:**
1. User logs in (Supabase auth) or accepts an invite email → sets password via `SetPassword`
2. User enters a client name and vendor name
3. The app calls `POST /api/vendor/research` → Claude researches the vendor and returns structured data with a confidence score
4. If confidence < 70, the user sees a 422 error and cannot proceed
5. The frontend shows a **review modal** ("Review Before Generating Report") so the user can verify the Claude data before committing
6. User clicks "Confirm & Generate Report" → `POST /api/vendor/generate` is called
7. Backend calls Tavily to fetch real, live news URLs for the vendor
8. News is merged into the research data; profile is saved to `profiles` table
9. Python microservice generates the Word doc; file is streamed directly back to the browser
10. User downloads the `.docx` file


The goal is to eliminate the manual research step that precedes vendor negotiations.

---

## Architecture

### Local Development
```
frontend (React/Vite)       → localhost:5173
    ↓ axios (with JWT)
backend (Node/Express)      → localhost:3001
    ↓                          ↓
Claude API              Tavily API
(vendor research)       (real news URLs)
    ↓                          ↓
                        Python microservice → localhost:5050
                        (Word doc via python-docx)
    ↓
Supabase
(auth + database)
```

### Production (Railway)
```
Railway Service 1: backend (Node/Express) → gwfwebapp-production.up.railway.app
  - Builds frontend (Vite), moves dist to backend/public/
  - Serves React SPA as static files in production (NODE_ENV=production)
  - Handles all /api/* routes
  - Single deployed URL for both frontend and backend

Railway Service 2: python-microservice (Flask) → separate Railway URL
  - Backend calls it via PYTHON_SERVICE_URL env var
```

In production there are only **two Railway services** — the frontend is not separately deployed; it's built into the backend service's `public/` directory.

### Three Services for Local Dev

| Service | Start Command | Port | Directory |
|---------|--------------|------|-----------|
| All at once | `npm run dev` (from root) | — | `/` |
| Frontend | `npm run dev:frontend` | 5173 | `frontend/` |
| Backend | `npm run dev:backend` | 3001 | `backend/` |
| Python microservice | `npm run dev:python` | 5050 | `python-microservice/` |

> Root `package.json` uses `concurrently` to start all three with `npm run dev`.
> First run: `npm run install:all` to install all dependencies including Python packages.

---

## Directory Structure

```
GWF_WebApp/
├── package.json                       # Root monorepo scripts (concurrently dev, install:all, build)
├── railway.toml                       # Monorepo hint for Railway (services are configured per-service)
│
├── frontend/                          # React + Vite + Tailwind CSS v4
│   └── src/
│       ├── App.jsx                    # Routes + RootRoute (invite detection via IIFE)
│       ├── context/AuthContext.jsx    # Supabase auth state (signIn, signOut, signUp, setUserPassword)
│       ├── services/
│       │   ├── api.js                 # Axios instance with JWT auth interceptor (baseURL: localhost:3001/api)
│       │   └── supabase.js            # Supabase client
│       └── components/
│           ├── Auth/Login.jsx
│           ├── Auth/SetPassword.jsx   # Invite flow: user sets initial password after clicking invite email
│           ├── Auth/ProtectedRoute.jsx
│           ├── Layout/Layout.jsx      # Nav with Generate / History tabs + logout
│           └── VendorProfile/
│               ├── ProfileForm.jsx    # Two-step: research → ReviewModal → generate. Force Regenerate checkbox.
│               ├── ReviewModal.jsx    # Modal overlay showing Claude research data for user confirmation
│               └── ProfileHistory.jsx # Table of past profiles with Regenerate button (uses two-step flow)
│
├── backend/                           # Node.js + Express
│   ├── server.js                      # Entry point; serves frontend static files in production
│   ├── railway.json                   # Build: builds frontend → moves to backend/public; Start: node server.js
│   ├── public/                        # (generated in production) frontend Vite build output
│   ├── middleware/auth.js             # JWT verification via Supabase
│   ├── routes/
│   │   ├── auth.js                    # GET /api/auth/me
│   │   ├── vendor.js                  # POST /api/vendor/research, POST /api/vendor/generate, GET /api/vendor/download/:id
│   │   └── profiles.js               # GET /api/profiles (history, with user emails)
│   └── services/
│       ├── claudeService.js           # Calls Claude API, returns structured vendor JSON (no news)
│       ├── newsService.js             # Calls Tavily API, returns [{title, url}] array of real news
│       ├── cacheService.js            # Reads/writes vendor_cache table (7-day TTL)
│       ├── documentService.js         # Calls Python microservice to generate .docx
│       └── supabaseService.js         # Supabase admin client (service role key)
│
├── python-microservice/               # Flask + python-docx
│   ├── app.py                         # POST /generate-document, GET /health
│   ├── railway.json                   # Start: python app.py; healthcheck: /health
│   ├── services/word_generator.py     # Fills Word template with vendor data
│   └── templates/
│       ├── TEMPLATE 2026 GWFMOA_(Client)_(Vendor)_(mo,yr).docx   # MOA Word template
│       └── TEMPLATE 2026 GWFAnalysis_(Client)_(Vendor).xlsx       # (unused so far)
│
└── database/schema.sql                # Full Supabase schema (source of truth)
```

---

## API Endpoints

### `POST /api/vendor/research` (Step 1)
- **Input:** `{ clientName, vendorName, forceRegenerate }`
- **What it does:** Checks cache → calls Claude if needed → confidence check → updates cache
- **Returns:** `{ researchData, cached, updatedAt }`
- **Does NOT:** call Tavily, save to DB, or generate a document
- **422 response:** if `confidence_score < 70`

### `POST /api/vendor/generate` (Step 2 — called after user confirms review)
- **Input:** `{ clientName, vendorName, researchData, cacheUsed }` (researchData comes from Step 1)
- **What it does:** Calls Tavily → merges news into researchData → applies profile dedup rules → generates Word doc via Python microservice
- **Returns:** The `.docx` file streamed directly (Content-Type: `application/vnd.openxmlformats-officedocument...`)
- **Profile dedup rules** (applied after streaming the file — errors logged, not returned to client):
  - **Rule 1:** `cacheUsed=true` and profile already exists for this vendor → skip insert (no duplicate)
  - **Rule 2:** `cacheUsed=true` and no existing profile → insert new record
  - **Rule 3:** `cacheUsed=false` (force regenerated) → delete all existing records for vendor, insert fresh

### `GET /api/vendor/download/:id`
- Re-generates the Word doc from a stored profile's `research_data` (used for history downloads)
- The stored `research_data` already includes Tavily news from when the profile was originally generated

---

## Database (Supabase)

### Tables

**`vendor_cache`** — Shared cache of Claude research results
- `id`, `vendor_name` (unique), `research_data` (JSONB), `updated_at`
- RLS **disabled** (shared across all users, no user-specific data)
- Cache TTL: 7 days — checked in `cacheService.js`
- Note: cached records may not have `confidence_score` if cached before that field was added; the confidence check uses `?? 100` fallback so old cache entries pass through

**`profiles`** — Every generated profile
- `id`, `user_id`, `client_name`, `vendor_name`, `deal_description` (deprecated — no longer written, column kept to avoid migration), `research_data` (JSONB), `cache_used`, `created_at`
- `research_data` includes Tavily-sourced `recent_news` merged at generation time
- RLS enabled; users see only their own profiles
- INSERT policy also allows `service_role` (backend writes on behalf of users)

**`quote_sessions`** / **`session_line_items`** — Quote analysis tables (built, not yet wired to UI)

---

## Claude API Integration

- **File:** `backend/services/claudeService.js`
- **Model:** `claude-3-haiku-20240307`
- **Returns JSON with:**
  - `confidence_score` — integer 0–100; how confident Claude is the input is a real, known company
  - `matched_vendor_name` — official company name Claude resolved the input to
  - `vendor_profile_paragraph` — neutral 3-4 sentence description
  - `company_type`, `fiscal_year_end`, `estimated_annual_revenue`, `employees`
  - `competitors_core` — array of 4-6 competitors
- **Does NOT return `recent_news`** — news is now sourced from Tavily after user confirmation
- **Confidence check:** if `confidence_score < 70`, backend returns 422 before touching cache or DB
- **Temperature:** 0.3 (low, for factual consistency)
- **Timeout:** 60 seconds

---

## Tavily News Integration

- **File:** `backend/services/newsService.js`
- **Package:** `@tavily/core` (npm)
- **Called:** in `POST /api/vendor/generate` — after user confirms the review modal, before doc generation
- **Query:** `"[matched_vendor_name] company news"` with `max_results: 5`
- **Returns:** `[{ title, url }, ...]` — only title and URL are kept
- **Error handling:**
  - If `TAVILY_API_KEY` is missing → throws with config error message
  - If zero results returned → throws with "Company not found" message (surfaces as 500 to frontend)
- The resulting news array is merged into `research_data` as `recent_news` before saving to profiles and generating the doc

---

## Word Document Generation

- **File:** `python-microservice/services/word_generator.py`
- Uses `python-docx` to open the `.docx` template and fill table cells by matching label text
- Key label mappings: `company type`, `fiscal year end`, `estimated annual revenue`, `employees`, `competitors (core)`, `recent news`, `vendor profile`
- `deal description` label cell is left blank — the code no longer writes to it
- News items are rendered as bullet points with **real hyperlinks** (Word XML `w:hyperlink` elements)
- News `{title, url}` shape is identical whether sourced from Claude (old) or Tavily (new) — no format change needed
- Output saved to `/tmp/` then streamed back to the Node backend

---

## Auth Flow

### Normal Login
- Supabase handles all auth (email/password)
- Frontend stores session in Supabase's localStorage mechanism
- `api.js` interceptor attaches `Bearer <token>` to every request
- Backend `middleware/auth.js` verifies the JWT with Supabase
- Download endpoint (`GET /api/vendor/download/:id`) requires auth — frontend fetches it via `api.get()` with blob response type, then creates an object URL for download (not a plain `<a href>`)

### Invite Flow (new users)
1. Admin sends invite via Supabase dashboard
2. User clicks invite link → lands on `https://gwfwebapp-production.up.railway.app/#access_token=...&type=invite`
3. `App.jsx` reads `window.location.hash` at **module load time** (IIFE) before Supabase can clear it
4. `RootRoute` renders `<SetPassword />` instead of `<ProfileForm />`
5. Supabase auto-authenticates the user from the hash token; `ProtectedRoute` passes through
6. User sets password → `supabase.auth.updateUser({ password })` via `setUserPassword` in `AuthContext`
7. On success: `window.location.replace('/')` — forces full reload, clears hash, renders `ProfileForm`

**Why the IIFE matters:** Supabase processes and clears the hash asynchronously on init. By the time `ProtectedRoute` resolves auth and renders children, `window.location.hash` is already empty. Capturing it at module load time freezes the value before any async operations run.

---

## Routing (App.jsx)

```jsx
// Module-level — captured before Supabase clears the hash
const isInviteFlow = (() => {
  const params = new URLSearchParams(window.location.hash.replace('#', ''))
  return params.get('type') === 'invite'
})()

function RootRoute() {
  return isInviteFlow ? <SetPassword /> : <ProfileForm />
}
```

| Path | Component | Notes |
|------|-----------|-------|
| `/login` | `Login` | Public |
| `/` | `RootRoute` | `SetPassword` if invite hash, else `ProfileForm` |
| `/history` | `ProfileHistory` | — |
| `*` | redirect to `/` | — |

All routes except `/login` are wrapped in `ProtectedRoute → Layout`.

> **Note:** There is no `/confirm` route. The invite flow is handled entirely at `/` via `RootRoute` — the hash is detected at module load time before Supabase can clear it.

---

## Known Issues Fixed (Session History)

| Issue | Fix |
|-------|-----|
| Generic "Failed to research vendor via Claude API" error | Improved error propagation to surface real API errors |
| `claude-3-5-sonnet-20241022` model not found | Switched to `claude-3-haiku-20240307` |
| `vendor_cache` and `profiles` tables missing | Created tables in Supabase |
| RLS blocking backend writes | Disabled RLS on `vendor_cache`; added `service_role` to profiles INSERT policy |
| Wrong Supabase key (`sb_publishable_*`) | Replaced with actual service role key (`eyJ...`) |
| Download opened raw URL in browser (no auth) | Changed to `api.get()` with `responseType: 'blob'` + object URL |
| News articles not hyperlinked in Word doc | Added `_add_hyperlink()` using Word XML in `word_generator.py` |
| 3 news articles generated instead of 2 | Updated Claude prompt to request exactly 2 |
| Force Regenerate button missing | Added checkbox to `ProfileForm.jsx` |
| History tab Regenerate used raw link | Fixed to use same authenticated blob download pattern |
| Invite link showed `ProfileForm` instead of `SetPassword` | `isInviteFlow` converted from re-evaluated function to module-level IIFE; `RootRoute` component wraps the conditional |
| Hash cleared before route resolved | IIFE captures hash at module load time, before Supabase async init clears it |
| Fake/hallucinated news URLs from Claude | Removed `recent_news` from Claude prompt; replaced with Tavily web search in `newsService.js` |
| No vendor identity validation | Added `confidence_score` + `matched_vendor_name` to Claude response; backend returns 422 if score < 70 |
| Deal Description field removed | Removed from frontend form, backend routes, and word_generator.py; `deal_description` DB column kept but deprecated |
| Frontend used single-step flow (old `/generate` endpoint) | `ProfileForm.jsx` now calls `/research` first, shows `ReviewModal`, then `/generate` on confirm |
| History Regenerate used old single-step flow | `ProfileHistory.jsx` now calls `/research` → `/generate` with blob download and refreshes table |
| Duplicate profiles on repeated generation | Added dedup rules in `POST /api/vendor/generate` based on `cacheUsed` flag |

---

## Environment Variables

### `backend/.env`
```
CLAUDE_API_KEY=             # Anthropic API key
SUPABASE_URL=               # https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=  # Long eyJ... JWT (NOT the publishable key)
PYTHON_SERVICE_URL=         # http://localhost:5050 (local) or Railway URL (prod)
TAVILY_API_KEY=             # Tavily API key (required for news search at generate time)
PORT=3001                   # Railway sets this automatically in production
CORS_ORIGIN=                # http://localhost:5173 (local) or Railway frontend URL (prod)
                            # Can be omitted if frontend/backend share the same domain in prod
NODE_ENV=                   # set to "production" on Railway — enables static file serving
```

### `frontend/.env`
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_URL=               # optional, defaults to http://localhost:3001/api
                            # In production, leave unset — frontend is served from same origin as backend
```

### `python-microservice/.env`
```
PORT=5050                   # Railway sets this automatically in production
```

---

## Railway Deployment

### Services
Two Railway services in the same project:

**Service 1: `backend`** (root dir: `/`)
- Build: `cd frontend && npm install && npm run build && cd .. && mv frontend/dist backend/public && cd backend && npm install`
- Start: `cd backend && node server.js`
- Serves the React SPA from `backend/public/` when `NODE_ENV=production`
- Requires `TAVILY_API_KEY` env var to be set in Railway dashboard

**Service 2: `python-microservice`** (root dir: `python-microservice/`)
- Build: Nixpacks auto-detects Python
- Start: `python app.py`
- Health check: `GET /health`

### Key Production Differences vs Local
- Frontend is **not** a separate service — it's built into `backend/public/` at deploy time
- `NODE_ENV=production` must be set on the backend Railway service
- `PYTHON_SERVICE_URL` must point to the Railway URL of the python-microservice
- `TAVILY_API_KEY` must be set on the backend Railway service
- `CORS_ORIGIN` can be omitted if frontend and backend share the same Railway domain (they do)

---

## Potential Future Improvements

### High Priority
- **Model upgrade:** Switch back to a more capable Claude model (Sonnet/Opus) once API key has access — Haiku is fast/cheap but less accurate for research
- **Excel template:** `GWFAnalysis_(Client)_(Vendor).xlsx` exists in templates but is not yet wired up — likely intended for quote analysis
- **Quote analysis UI:** `quote_sessions` and `session_line_items` tables exist in the DB but have no frontend yet

### Medium Priority
- **Download from history:** History only has Regenerate (which calls Claude + Tavily again). Should add a separate Download button that re-generates the doc from existing `research_data` (which includes Tavily news) without a new Claude or Tavily call — the `/download/:id` endpoint already supports this
- **Cache management UI:** No way to view or manually clear the vendor cache — useful when data is stale
- **Error display in history:** History tab uses `alert()` for errors — should use the same styled error component as ProfileForm
- **User-scoped history:** Currently `GET /api/profiles` returns ALL profiles (no `WHERE user_id = ...` filter) — should be scoped per user
- **ReviewModal editing:** Currently read-only — user can inspect data but not edit before confirming

### Low Priority / Nice to Have
- **nodemon for development:** Add `nodemon` as a dev dependency so the backend auto-restarts on file changes
- **PDF export option:** Some users may prefer PDF over .docx
- **Pagination in history:** History table will grow unbounded — needs pagination or a limit
