# VoxIndex Start Here

This is the quickest runbook for getting VoxIndex working locally with the real IndexTTS2 model.
The commands below are written to work on any machine. Replace the placeholders with your own repo, venv, and model paths.

## 1. What This Repo Is

VoxIndex is the app repo. It contains:

- `backend/` - FastAPI API, auth, synthesis jobs, and TTS integration
- `frontend/` - React + Vite UI
- `index-tts/` - vendored IndexTTS2 source code
- `storage/` - uploaded voice references and generated audio files

The backend can run with either:

- `TTS_PROVIDER=stub` for fast development
- `TTS_PROVIDER=indextts2` for real model inference

## 2. Prerequisites

You need:

- Python 3.9+ or 3.10+ recommended
- Node.js 20.19+ or 22.12+
- npm 10+
- PostgreSQL 14+
- The `index-tts/checkpoints/` folder populated with the model files

Optional but helpful:

- pgAdmin for database setup
- a GPU if you want faster inference

## 3. Global Setup (Recommended)

Use this version if you want the runbook to work on any machine.

- Repo path: wherever you cloned VoxIndex
- Project venv: the local `.venv` inside that repo, or a global Python environment if you prefer
- Model repo: wherever you placed `index-tts`

Run these once after cloning the repo.

### Backend

```powershell
cd <path-to-your-VoxIndex-repo>
.\.venv\Scripts\Activate.ps1
cd backend

# If needed, create the .env from the example
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Edit `backend/.env` and make sure these are set:

```env
TTS_PROVIDER=indextts2
INDEXTTS2_CONFIG_PATH=../index-tts/checkpoints/config.yaml
INDEXTTS2_MODEL_DIR=../index-tts/checkpoints
DATABASE_URL=postgresql://postgres:<password>@localhost:5432/voice_synthesis
```

### Frontend

```powershell
cd <path-to-your-VoxIndex-repo>\frontend
npm install
```

## 4. Generic Example

If you want a concrete example, use this pattern on any machine:

```powershell
cd <path-to-your-VoxIndex-repo>
.\.venv\Scripts\Activate.ps1
cd backend
python -m uvicorn main:app --host 127.0.0.1 --port 8002 --reload --log-level debug
```

```powershell
cd <path-to-your-VoxIndex-repo>\frontend
npm run dev
```

```powershell
cd <path-to-your-VoxIndex-repo>\index-tts
<path-to-your-VoxIndex-repo>\.venv\Scripts\python.exe webui.py
```

## 5. Start the Full App

### Terminal 1: Backend

Run the backend from `backend/` so the `app` package resolves correctly.

```powershell
cd <path-to-your-VoxIndex-repo>\backend
python -m uvicorn main:app --host 127.0.0.1 --port 8002 --reload --log-level debug
```

### Terminal 2: Frontend

```powershell
cd <path-to-your-VoxIndex-repo>\frontend
npm run dev
```

Open:

```text
http://localhost:5173
```

## 6. How To Test It

Use this order:

1. Register a new user
2. Log in
3. Upload a voice reference
4. Create a synthesis job
5. Wait for completion
6. Download/play the audio

The fastest automated check is:

```powershell
cd <path-to-your-VoxIndex-repo>
.\.venv\Scripts\Activate.ps1
python scripts\smoke_test.py
```

If the smoke test works, you should see a new WAV file under `storage/outputs/`.

## 7. Standalone IndexTTS2 Demo

If you want to run the model without VoxIndex, use the vendored `index-tts/` project directly.

### Install model extras

```powershell
cd <path-to-your-VoxIndex-repo>\index-tts
<path-to-your-VoxIndex-repo>\.venv\Scripts\python.exe -m pip install -e ".[webui]"
```

### Start the Web UI

```powershell
cd <path-to-your-VoxIndex-repo>\index-tts
<path-to-your-VoxIndex-repo>\.venv\Scripts\python.exe webui.py
```

Open:

```text
http://127.0.0.1:7860
```

### Python Inference Example

```python
from indextts.infer_v2 import IndexTTS2

tts = IndexTTS2(
    cfg_path="checkpoints/config.yaml",
    model_dir="checkpoints",
    use_fp16=False,
    use_cuda_kernel=False,
    use_deepspeed=False,
)

tts.infer(
    spk_audio_prompt="examples/voice_01.wav",
    text="Translate for me, what is a surprise!",
    output_path="gen.wav",
    verbose=True,
)
```

## 8. Common Problems

### `ModuleNotFoundError: No module named 'app'`

Start the backend from `backend/`:

```powershell
cd <path-to-your-VoxIndex-repo>\backend
python -m uvicorn main:app --host 127.0.0.1 --port 8002 --reload
```

### `bcrypt` / `passlib` errors

Reinstall the backend auth dependencies inside the project venv:

```powershell
cd <path-to-your-VoxIndex-repo>
.\.venv\Scripts\python.exe -m pip install --upgrade --force-reinstall "passlib[bcrypt]==1.7.4" "bcrypt==3.2.2"
```

### `gradio` missing when launching `webui.py`

Install the WebUI extras:

```powershell
cd <path-to-your-VoxIndex-repo>\index-tts
<path-to-your-VoxIndex-repo>\.venv\Scripts\python.exe -m pip install -e ".[webui]"
```

### Checkpoints not found

Confirm this file exists:

```text
index-tts/checkpoints/config.yaml
```

If not, download or copy the model files into `index-tts/checkpoints/`.

## 9. Team Workflow

For you and your friend, the simplest workflow is:

1. Pull the latest branch
2. Start backend and frontend locally
3. Run `scripts/smoke_test.py` before pushing changes
4. Keep large model files and checkpoints out of git
5. If you change the model setup, update `backend/.env.example` and this doc

## 10. Notes

- Use `backend/` as the working directory for the API server.
- Use the project venv at your repo's `.venv` when running this repo; `D:\!Codes\Indextts\VoxIndex\.venv` is the example for this workspace.
- Keep `index-tts/checkpoints/` local; do not commit the model weights.
