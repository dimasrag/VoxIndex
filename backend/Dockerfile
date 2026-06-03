FROM nvidia/cuda:12.1.1-base-ubuntu22.04
ENV DEBIAN_FRONTEND=noninteractive

# System deps
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv git curl ffmpeg build-essential \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python requirements if present
COPY backend/requirements.txt ./requirements.txt
RUN if [ -s requirements.txt ]; then pip3 install --no-cache-dir -r requirements.txt; fi

# Copy backend source
COPY backend/ ./

# Copy local index-tts runtime into image and install it.
# This allows `from indextts import ...` inside the container.
# The source is copied from the repo root `index-tts/` folder.
COPY ../index-tts /opt/index-tts

# Ensure build tools and audio libs are available for native extensions
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    build-essential python3-dev cmake libsndfile1 libsndfile1-dev pkg-config \
  && rm -rf /var/lib/apt/lists/*

# Upgrade pip and install CUDA-enabled PyTorch and torchaudio from the PyTorch index,
# then install the local `index-tts` package in editable mode.
RUN python3 -m pip install --no-cache-dir --upgrade pip setuptools wheel \
  && python3 -m pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cu128 --extra-index-url https://pypi.org/simple "torch" "torchaudio" \
  && python3 -m pip install --no-cache-dir -e /opt/index-tts

# Environment defaults (can be overridden by compose)
ENV INDEXTTS2_MODEL_DIR=/checkpoints \
    INDEXTTS2_HF_CACHE_DIR=/hf_cache \
    INDEXTTS2_FEATURE_EXTRACTOR_DIR=/checkpoints/w2v-bert-2.0-feature-extractor \
    INDEXTTS2_USE_FP16=true \
    TTS_PROVIDER=indextts2

EXPOSE 8000

# Start the FastAPI app (backend/main.py should contain `app`)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
