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

## Setup Instructions

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

**Frontend:**
```bash
cd frontend
npm install
```

**Backend:**
```bash
cd backend
npm install
```

**Python Microservice:**
```bash
cd python-microservice
pip install -r requirements.txt
# Generate the base template (if not exists)
python3 create_template.py
```

## Running the Application

You need to run all three services simultaneously (e.g., in separate terminal tabs):

**1. Python Microservice (Port 5001):**
```bash
cd python-microservice
PORT=5001 python3 app.py
```

**2. Backend API (Port 3001):**
```bash
cd backend
npm start
```

**3. Frontend (Port 5173):**
```bash
cd frontend
npm run dev
```

Visit `http://localhost:5173` to use the app.

## Features
- **Login**: Email/password authentication via Supabase.
- **Generate Profile**: Input vendor details -> fetching research -> generate Word doc.
- **History**: View and regenerate past profiles.
- **Caching**: Research data is cached for 7 days to save API costs.
