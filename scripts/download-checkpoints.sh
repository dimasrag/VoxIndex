#!/usr/bin/env bash
HfRepo="IndexTeam/IndexTTS-2"
DEST="../index-tts/checkpoints"

if ! command -v hf >/dev/null 2>&1; then
  echo "The 'hf' CLI is not installed. Install: pip install huggingface_hub"
  exit 1
fi

mkdir -p "$DEST"
hf download "$HfRepo" --local-dir="$DEST"
echo "Download complete. Update backend/.env to point INDEXTTS2_MODEL_DIR to the checkpoints path."
