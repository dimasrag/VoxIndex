# VoxIndex Backend

FastAPI backend for VoxIndex.

## Requirements

- Python 3.10+
- PostgreSQL 15+
- ffmpeg available in PATH

## Setup

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
```

Update required values in `.env`:
- `SECRET_KEY`
- `DATABASE_URL`

Run server:

```powershell
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Open:
- API docs: http://localhost:8000/docs
- Health: http://localhost:8000/api/health

## Environment Variables

Base:
- `SECRET_KEY`
- `ALGORITHM`
- `ACCESS_TOKEN_EXPIRE_MINUTES`
- `DATABASE_URL`
- `STORAGE_PATH`
- `FRONTEND_ORIGINS`
- `FRONTEND_ORIGIN_REGEX`
- `FRONTEND_APP_URL`

Email reset:
- `EMAIL_PROVIDER` (`local` or `smtp`)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`
- `SMTP_FROM_EMAIL`, `SMTP_USE_TLS`, `SMTP_USE_SSL`, `SMTP_TIMEOUT_SECONDS`
- `PASSWORD_RESET_EXPIRE_MINUTES`

TTS:
- `TTS_PROVIDER` (`indextts2` or `stub`)
- `INDEXTTS2_CONFIG_PATH`
- `INDEXTTS2_MODEL_DIR`
- `INDEXTTS2_USE_FP16`
- `INDEXTTS2_USE_CUDA_KERNEL`
- `INDEXTTS2_USE_DEEPSPEED`

## Implemented API Groups

- `/api/auth` register, login, profile, avatar, forgot/reset password
- `/api/voice-refs` upload/list/delete voice references
- `/api/synthesis` create/list jobs, audio download, warmup
- `/api/admin` users, activity, stats (admin-only)
- `/api/sample` sample history

## Operational Notes

- On startup, tables are created automatically and missing `users` columns are patched (`is_admin`, `avatar_filename`).
- If `TTS_PROVIDER=indextts2`, backend attempts model warmup during startup.
- Static files are served at:
  - `/static/voice_refs`
  - `/static/outputs`
  - `/static/avatars`
