# Frontend (VoxIndex)

React + Vite frontend for authentication, synthesis input, and synthesis history.

## Requirements

- Node.js 20.19+ or 22.12+
- npm 10+

## Setup

```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

App runs at http://localhost:5173 by default.

## Environment

- VITE_API_URL: backend API base URL (default in .env.example points to http://localhost:8000/api)

## Scripts

- npm run dev: start development server
- npm run build: build production bundle
- npm run preview: preview production build
- npm run lint: run ESLint

## Current Pages

- /login
- /register
- /dashboard
- /synthesis
- /history

Planned pages from thesis (not fully implemented yet): profile, forgot password, admin dashboard pages.
