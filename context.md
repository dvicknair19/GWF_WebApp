# GWF WebApp — Project Context
**Last Updated:** 2026-02-16
**Owner:** David
**Company:** Gray Wolf Financial (GWF) — vendor-agnostic consulting firm

---

## What This App Does

GWF WebApp is an internal tool for Gray Wolf Financial that automates the creation of vendor profile documents used in Master Services Agreement (MSA) negotiations.

**Core workflow:**
1. User logs in (Supabase auth)
2. User enters a client name, vendor name, and optional deal description
3. The app calls the Claude API to research the vendor and return structured data (company type, revenue, employees, competitors, recent news)
4. That data is inserted into a Word document template (`GWFMOA`) via a Python microservice
5. User downloads the `.docx` file

The goal is to eliminate the manual research step that precedes vendor negotiations.

---

## Architecture

```
frontend (React/Vite)       → localhost:5173
    ↓ axios (with JWT)
backend (Node/Express)      → localhost:3001
    ↓                          ↓
Claude API              Python microservice → localhost:5050
(vendor research)       (Word doc generation via python-docx)
    ↓
Supabase
(auth + database)
```

### Three Services — All Must Be Running

| Service | Start Command | Port | Directory |
|---------|--------------|------|-----------|
| Frontend | `npm run dev` | 5173 | `frontend/` |
| Backend | `node server.js` | 3001 | `backend/` |
| Python microservice | `python3 app.py` | 5050 | `python-microservice/` |

---

## Directory Structure

```
GWF_WebApp/
├── frontend/                          # React + Vite + Tailwind CSS v4
│   └── src/
│       ├── App.jsx                    # Routes: / (ProfileForm), /history (ProfileHistory)
│       ├── context/AuthContext.jsx    # Supabase auth state (signIn, signOut, signUp)
│       ├── services/
│       │   ├── api.js                 # Axios instance with JWT auth interceptor (baseURL: localhost:3001/api)
│       │   └── supabase.js            # Supabase client
│       └── components/
│           ├── Auth/Login.jsx
│           ├── Auth/ProtectedRoute.jsx
│           ├── Layout/Layout.jsx      # Nav with Generate / History tabs + logout
│           └── VendorProfile/
│               ├── ProfileForm.jsx    # Main generate form + Force Regenerate checkbox
│               └── ProfileHistory.jsx # Table of past profiles with Regenerate button
│
├── backend/                           # Node.js + Express
│   ├── server.js                      # Entry point, CORS (localhost:5173), routes
│   ├── middleware/auth.js             # JWT verification via Supabase
│   ├── routes/
│   │   ├── auth.js                    # GET /api/auth/me
│   │   ├── vendor.js                  # POST /api/vendor/generate, GET /api/vendor/download/:id
│   │   └── profiles.js               # GET /api/profiles (history, with user emails)
│   └── services/
│       ├── claudeService.js           # Calls Claude API, returns structured vendor JSON
│       ├── cacheService.js            # Reads/writes vendor_cache table (7-day TTL)
│       ├── documentService.js         # Calls Python microservice to generate .docx
│       └── supabaseService.js         # Supabase admin client (service role key)
│
├── python-microservice/               # Flask + python-docx
│   ├── app.py                         # POST /generate-document endpoint
│   ├── services/word_generator.py     # Fills Word template with vendor data
│   └── templates/
│       ├── TEMPLATE 2026 GWFMOA_(Client)_(Vendor)_(mo,yr).docx   # MOA Word template
│       └── TEMPLATE 2026 GWFAnalysis_(Client)_(Vendor).xlsx       # (unused so far)
│
└── database/schema.sql                # Full Supabase schema (source of truth)
```

---

## Database (Supabase)

### Tables

**`vendor_cache`** — Shared cache of Claude research results
- `id`, `vendor_name` (unique), `research_data` (JSONB), `updated_at`
- RLS **disabled** (shared across all users, no user-specific data)
- Cache TTL: 7 days — checked in `cacheService.js`

**`profiles`** — Every generated profile
- `id`, `user_id`, `client_name`, `vendor_name`, `deal_description`, `research_data` (JSONB), `cache_used`, `created_at`
- RLS enabled; users see only their own profiles
- INSERT policy also allows `service_role` (backend writes on behalf of users)

**`quote_sessions`** / **`session_line_items`** — Quote analysis tables (built, not yet wired to UI)

---

## Claude API Integration

- **File:** `backend/services/claudeService.js`
- **Model:** `claude-3-haiku-20240307` (switched from `claude-3-5-sonnet-20241022` which wasn't available on the current API key)
- **Returns JSON with:**
  - `vendor_profile_paragraph` — neutral 3-4 sentence description
  - `company_type`, `fiscal_year_end`, `estimated_annual_revenue`, `employees`
  - `competitors_core` — array of 4-6 competitors
  - `recent_news` — array of exactly **2** items, each with `title` and `url`
- **Temperature:** 0.3 (low, for factual consistency)
- **Timeout:** 60 seconds

---

## Word Document Generation

- **File:** `python-microservice/services/word_generator.py`
- Uses `python-docx` to open the `.docx` template and fill table cells by matching label text
- Key label mappings: `company type`, `fiscal year end`, `estimated annual revenue`, `employees`, `competitors (core)`, `recent news`, `deal description`, `vendor profile`
- News items are rendered as bullet points with **real hyperlinks** (Word XML `w:hyperlink` elements)
- Output saved to `/tmp/` then streamed back to the Node backend

---

## Auth Flow

- Supabase handles all auth (email/password)
- Frontend stores session in Supabase's localStorage mechanism
- `api.js` interceptor attaches `Bearer <token>` to every request
- Backend `middleware/auth.js` verifies the JWT with Supabase
- Download endpoint (`GET /api/vendor/download/:id`) requires auth — frontend fetches it via `api.get()` with blob response type, then creates an object URL for download (not a plain `<a href>`)

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

---

## Environment Variables

### `backend/.env`
```
CLAUDE_API_KEY=          # Anthropic API key
SUPABASE_URL=            # https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=  # Long eyJ... JWT (NOT the publishable key)
PYTHON_SERVICE_URL=      # http://localhost:5050
PORT=3001                # optional
CORS_ORIGIN=             # optional, defaults to http://localhost:5173
```

### `frontend/.env`
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_URL=            # optional, defaults to http://localhost:3001/api
```

### `python-microservice/.env`
```
(minimal — Flask runs on port 5050 by default)
```

---

## Potential Future Improvements

### High Priority
- **Model upgrade:** Switch back to a more capable Claude model (Sonnet/Opus) once API key has access — Haiku is fast/cheap but less accurate for research
- **Excel template:** `GWFAnalysis_(Client)_(Vendor).xlsx` exists in templates but is not yet wired up — likely intended for quote analysis
- **Quote analysis UI:** `quote_sessions` and `session_line_items` tables exist in the DB but have no frontend yet

### Medium Priority
- **Download from history:** Currently history only has Regenerate (which calls Claude again). Should add a separate Download button that re-generates the doc from existing cached `research_data` without a new Claude call
- **Cache management UI:** No way to view or manually clear the vendor cache — useful when data is stale
- **Error display in history:** History tab uses `alert()` for errors — should use the same styled error component as ProfileForm
- **User-scoped history:** Currently `GET /api/profiles` returns ALL profiles (no `WHERE user_id = ...` filter) — should be scoped per user

### Low Priority / Nice to Have
- **nodemon for development:** Add `nodemon` as a dev dependency so the backend auto-restarts on file changes
- **Startup script:** A single shell script or `package.json` at the root to start all three services at once
- **Real news URLs:** Claude sometimes generates plausible-looking but fake URLs for recent news — consider integrating a real news API (NewsAPI, Perplexity) for verified links
- **PDF export option:** Some users may prefer PDF over .docx
- **Pagination in history:** History table will grow unbounded — needs pagination or a limit
