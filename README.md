# VoxIndex

<p align="center">
    <img src="frontend/src/assets/Logo.png" alt="VoxIndex logo" width="220" />
</p>

A full-stack web application for text-to-speech workflows, built with FastAPI (backend), React + Vite (frontend), and PostgreSQL (database).

This repository currently runs an end-to-end MVP flow (auth, upload voice reference, synthesis job, history, audio playback/download). The current TTS service is a development stub and can be replaced with real IndexTTS2 inference later.

For a step-by-step startup guide, see [docs/START_HERE.md](docs/START_HERE.md).

## Prerequisites

- Backend: FastAPI, SQLAlchemy, Uvicorn, python-jose, passlib
- Frontend: React 19, Vite 7, React Router 7, Axios
- Database: PostgreSQL 15+
- Runtime: Python 3.10+ recommended, Node.js 20+

## Repository Structure

```text
.
|- backend/                FastAPI app
|  |- app/
|  |  |- api/              Route handlers
|  |  |- models/           SQLAlchemy models
|  |  |- services/         Auth, email, TTS services
|  |- main.py
|  |- requirements.txt
|- frontend/               React + Vite app
|  |- src/
|  |  |- api/
|  |  |- components/
|  |  |- context/
|  |  |- pages/
|- storage/                Runtime file storage (voice refs, outputs)
|- docker-compose.yml      Optional containerized stack
```

## Quick Start (Local)

1. Backend

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
```

Set these values in `backend/.env`:
- `SECRET_KEY` to a long random string
- `DATABASE_URL` to your PostgreSQL database

Start backend:

```powershell
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

2. Frontend

```powershell
cd ../frontend
npm install
copy .env.example .env
npm run dev
```

Open:
- Frontend: http://localhost:5173
- Backend docs: http://localhost:8000/docs
- Health check: http://localhost:8000/api/health

## Environment Files

- Backend template: [backend/.env.example](backend/.env.example)
- Frontend template: [frontend/.env.example](frontend/.env.example)

Important:
- Do not commit real `.env` files.
- Do not commit model checkpoints or large artifacts.

## API Surface (Implemented)

Auth:
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `PATCH /api/auth/me`
- `POST /api/auth/me/avatar`
- `DELETE /api/auth/me/avatar`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`

Voice references:
- `POST /api/voice-refs/upload`
- `GET /api/voice-refs/`
- `DELETE /api/voice-refs/{voice_ref_id}`

Synthesis:
- `POST /api/synthesis/`
- `GET /api/synthesis/`
- `GET /api/synthesis/{job_id}/audio`
- `POST /api/synthesis/warmup`

Admin:
- `GET /api/admin/users`
- `DELETE /api/admin/users/{user_id}`
- `GET /api/admin/activity`
- `GET /api/admin/stats/overview`
- `GET /api/admin/stats/users/growth`

Sample:
- `GET /api/sample/history`

## Docker Compose (Optional)

`docker-compose.yml` is prepared for a backend + postgres stack and now uses named volumes.

Before first run, set database env vars in your shell or compose env file:
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`

Then run:

```powershell
docker compose up --build
```

Notes:
- Compose is configured with `gpus: all` for CUDA hosts.
- Real `indextts2` still requires model runtime/checkpoints availability.

## Model Integration Notes

This repo does not include IndexTTS2 checkpoints.

If you use `TTS_PROVIDER=indextts2`, make sure these are valid:
- `INDEXTTS2_CONFIG_PATH`
- `INDEXTTS2_MODEL_DIR`

If you only need functional end-to-end app flow, use `TTS_PROVIDER=stub`.

## Additional Docs

- [docs/START_HERE.md](docs/START_HERE.md)
- [docs/DEPLOY_PUBLIC.md](docs/DEPLOY_PUBLIC.md)

## Result Example
https://private-user-images.githubusercontent.com/98831909/657987097-6cd231a2-764d-42fd-ba0a-15f24c17d0e6.mp4?jwt=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3OTAyNDcyNjgsIm5iZiI6MTc5MDI0Njk2OCwicGF0aCI6Ii85ODgzMTkwOS82NTc5ODcwOTctNmNkMjMxYTItNzY0ZC00MmZkLWJhMGEtMTVmMjRjMTdkMGU2Lm1wND9YLUFtei1BbGdvcml0aG09QVdTNC1ITUFDLVNIQTI1NiZYLUFtei1DcmVkZW50aWFsPUFLSUFWQ09EWUxTQTUzUFFLNFpBJTJGMjAyNjA5MjQlMkZ1cy1lYXN0LTElMkZzMyUyRmF3czRfcmVxdWVzdCZYLUFtei1EYXRlPTIwMjYwOTI0VDEwNDkyOFomWC1BbXotRXhwaXJlcz0zMDAmWC1BbXotU2lnbmF0dXJlPTYyNTJiNGZmMzBkNzg5Y2E5ZTBmZTY5N2I0MDkxNTNmOThiYzgwYjY3OWNkZWZkZmE5M2NlMWExZjYzZDQ3NTEmWC1BbXotU2lnbmVkSGVhZGVycz1ob3N0JnJlc3BvbnNlLWNvbnRlbnQtdHlwZT12aWRlbyUyRm1wNCJ9.m5Lj6_IRq_15Pl-x_K7SCmepRFx78980xUYag57pPLI
