# VoxIndex

A full-stack web application for text-to-speech workflows, built with FastAPI (backend), React + Vite (frontend), and PostgreSQL (database).

This repository currently runs an end-to-end MVP flow (auth, upload voice reference, synthesis job, history, audio playback/download). The current TTS service is a development stub and can be replaced with real IndexTTS2 inference later.

For a step-by-step startup guide, see [docs/START_HERE.md](docs/START_HERE.md).

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

## Public Deployment (Keep the GPU on Your PC)

If you want other people to use the web app while the backend stays on your own machine, the simplest path is:

1. Deploy the frontend to Vercel.
2. Expose the backend with Cloudflare Tunnel (or ngrok).
3. Point the frontend `VITE_API_URL` to the public backend URL.
4. Add your frontend domain to `FRONTEND_ORIGINS` in the backend env.

See [docs/DEPLOY_PUBLIC.md](docs/DEPLOY_PUBLIC.md) for the exact steps.

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

## IndexTTS2 (Model) Setup

This application integrates with the IndexTTS2 model but does not include the model checkpoints in this repo.

Recommended local layout: keep the model repository and checkpoints outside the app repo (sibling folder). Example:

```
../index-tts    # IndexTTS2 repo + checkpoints (sibling folder)
./              # This application (this repo)
```

Quick setup (Windows PowerShell):

```powershell
# Clone IndexTTS2 (keep outside this repo, as a sibling folder)
git clone https://github.com/IndexTeam/IndexTTS-2.git ../index-tts
cd ../index-tts

# (Optional) create a venv for the model environment
python -m venv .venv
.venv\Scripts\Activate.ps1

# Install model package and dependencies
pip install -e .

# Use the Hugging Face CLI to download checkpoints into a local `checkpoints/` folder
# (you need to have 'hf' installed and be logged in if required)
hf download IndexTeam/IndexTTS-2 --local-dir=checkpoints
```

After downloading, point the backend env values to the model location (example `backend/.env`). Prefer relative paths when `index-tts` is a sibling folder:

```
INDEXTTS2_CONFIG_PATH=../index-tts/checkpoints/config.yaml
INDEXTTS2_MODEL_DIR=../index-tts/checkpoints
```

Security & repo notes:
- Do NOT commit the `index-tts` repo or `checkpoints/` to this repository — they are large and should be kept out of version control.
- This repo's `.gitignore` already excludes common model files and checkpoints.

