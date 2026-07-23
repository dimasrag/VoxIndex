# Frontend (VoxIndex)

<p align="center">
	<img src="src/assets/Logo.png" alt="VoxIndex logo" width="200" />
</p>

React + Vite client application for VoxIndex.

## Requirements

- Node.js 20+
- npm 10+

## Setup

```powershell
cd frontend
npm install
copy .env.example .env
npm run dev
```

Default app URL: http://localhost:5173

## Environment

Template: [frontend/.env.example](.env.example)

Main variable:
- `VITE_API_URL` (example: `http://localhost:8000/api`)

## Scripts

- `npm run dev` start dev server
- `npm run build` build production bundle
- `npm run preview` preview production build
- `npm run lint` run ESLint

## Implemented Routes

Public:
- `/home`
- `/login`
- `/register`
- `/forgot-password`
- `/reset-password`
- `/sample`

Authenticated:
- `/dashboard`
- `/synthesis`
- `/history`
- `/profile`

Admin only:
- `/admin`

## Notes

- Auth token is stored in local storage and attached as `Authorization: Bearer ...`.
- When backend returns `401`, the app clears token and redirects to login.
- Static audio playback URLs are resolved from the backend base URL (`/static/outputs/...`).
