# VoxIndex

A full-stack web application for text-to-speech workflows, built with FastAPI (backend), React + Vite (frontend), and PostgreSQL (database).

This repository currently runs an end-to-end MVP flow (auth, upload voice reference, synthesis job, history, audio playback/download). The current TTS service is a development stub and can be replaced with real IndexTTS2 inference later.

## Tech Stack

- Backend: FastAPI, Uvicorn, SQLAlchemy, python-jose (JWT), passlib (bcrypt)
- Frontend: React, Vite, React Router, Axios
- Database: PostgreSQL
- Storage: Local filesystem under storage/voice_refs and storage/outputs
- Environment: python-dotenv

## Prerequisites

- Python 3.9+
- Node.js 20.19+ or 22.12+
- npm 10+
- PostgreSQL 14+ (pgAdmin optional but recommended)

## Project Structure

```
├── backend/           # FastAPI backend
│   ├── app/
│   │   ├── api/       # Route handlers
│   │   ├── models/    # SQLAlchemy ORM models
│   │   └── services/  # Business logic (auth, TTS)
│   ├── main.py
│   └── requirements.txt
├── frontend/          # React + Vite frontend
│   └── src/
│       ├── api/       # Axios client
│       ├── components/# Reusable components
│       ├── context/   # React context (auth)
│       └── pages/     # Page components
└── storage/           # File storage
    ├── voice_refs/    # Uploaded voice reference audio files
    └── outputs/       # Synthesized audio output files
```

## Backend Setup

Windows PowerShell example:

```bash
cd backend

# Create virtual environment
python -m venv .venv
.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Configure environment
copy .env.example .env
# Edit .env and set at least:
#   SECRET_KEY=<long-random-secret>
#   DATABASE_URL=postgresql://postgres:<password>@localhost:5432/voice_synthesis

# Create the PostgreSQL database (run once)
psql -U postgres -c "CREATE DATABASE voice_synthesis;"

# Start the server (SQLAlchemy creates tables automatically on first run)
uvicorn main:app --reload --port 8000
```

If psql is not available in PATH, create the database in pgAdmin:

1. Register/connect local server (localhost:5432).
2. Right click Databases -> Create -> Database.
3. Name: voice_synthesis.

The API will be available at http://localhost:8000.
API documentation: http://localhost:8000/docs

## Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
copy .env.example .env
# Edit .env if your backend runs on a different port

# Start development server
npm run dev
```

The app will be available at http://localhost:5173.

## API Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Login and get JWT token |
| GET | `/api/voice-refs/` | List user's voice references |
| POST | `/api/voice-refs/upload` | Upload a voice reference audio file |
| DELETE | `/api/voice-refs/{id}` | Delete a voice reference |
| POST | `/api/synthesis/` | Create a new synthesis job |
| GET | `/api/synthesis/` | List user's synthesis jobs |
| GET | `/api/synthesis/{id}/audio` | Download synthesis audio |
| GET | `/api/admin/users` | List all users (admin only) |
| GET | `/api/admin/activity` | List all synthesis jobs (admin only) |

## Current Feature Status (Thesis Alignment)

Implemented now:

- Register and Login
- JWT-protected user sessions
- Upload voice reference audio
- Create synthesis job from text + selected voice reference
- Synthesis history page
- Audio playback/download from generated output
- Basic admin APIs for user/activity listing

Planned or partially documented (not fully implemented yet):

- Forgot password and reset token/email workflow
- Profile page and change password UI/API
- Emotion control parameters passed through synthesis pipeline
- Full admin dashboard UI for user management and activity monitoring
- Dedicated activity/audit models beyond current synthesis history

If these planned features are included in thesis diagrams, mark them as Proposed Design / Future Work unless implemented in code.

## Notes

- The backend supports `stub` and `indextts2` synthesis providers. `stub` copies the voice reference as placeholder output for development.
- Audio files are stored in `storage/voice_refs/` and `storage/outputs/`.
- JWT tokens expire after 60 minutes by default (configurable via `ACCESS_TOKEN_EXPIRE_MINUTES`).

## TTS Provider Configuration

Backend supports two synthesis providers via `.env`:

- `TTS_PROVIDER=stub`: Development mode (copies voice reference as placeholder output)
- `TTS_PROVIDER=indextts2`: Uses real IndexTTS2 inference

When using `indextts2`, set:

- `INDEXTTS2_CONFIG_PATH` (default: `checkpoints/config.yaml`)
- `INDEXTTS2_MODEL_DIR` (default: `checkpoints`)
- `INDEXTTS2_USE_FP16` (`true`/`false`)
- `INDEXTTS2_USE_CUDA_KERNEL` (`true`/`false`)
- `INDEXTTS2_USE_DEEPSPEED` (`true`/`false`)
