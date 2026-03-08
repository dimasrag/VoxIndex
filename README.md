# Voice Synthesis App

A full-stack text-to-speech web application built with FastAPI (backend) and React + Vite (frontend).

## Prerequisites

- Python 3.9+
- Node.js 20.19+ or 22.12+
- npm 10+
- PostgreSQL 14+

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

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and set a strong SECRET_KEY and your PostgreSQL credentials:
#   DATABASE_URL=postgresql://<user>:<password>@<host>:<port>/<dbname>

# Create the PostgreSQL database (run once)
psql -U postgres -c "CREATE DATABASE voice_synthesis;"

# Start the server (SQLAlchemy creates tables automatically on first run)
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`.
API documentation: `http://localhost:8000/docs`

## Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env if your backend runs on a different port

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`.

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

## Notes

- The TTS synthesis is currently a stub that copies the voice reference file as output. Replace `backend/app/services/tts.py` with actual IndexTTS2 integration.
- Audio files are stored in `storage/voice_refs/` and `storage/outputs/`.
- JWT tokens expire after 60 minutes by default (configurable via `ACCESS_TOKEN_EXPIRE_MINUTES`).
