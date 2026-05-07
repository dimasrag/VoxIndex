import os
import shutil
import logging
from typing import Optional

logger = logging.getLogger(__name__)


class TTSServiceError(Exception):
    """Raised when synthesis cannot be completed due to runtime/configuration issues."""


class _IndexTTS2Engine:
    """Lazy-loaded wrapper around IndexTTS2 model initialization and inference."""

    def __init__(self) -> None:
        self._model = None

    def _load(self):
        if self._model is not None:
            return self._model

        try:
            # IndexTTS2 reference API from official repo: indextts.infer_v2.IndexTTS2
            from indextts.infer_v2 import IndexTTS2
        except Exception as exc:  # pragma: no cover - import failure depends on runtime env
            raise TTSServiceError(
                "IndexTTS2 is not available. Install and configure the official index-tts runtime first."
            ) from exc

        cfg_path = os.getenv("INDEXTTS2_CONFIG_PATH", "checkpoints/config.yaml")
        model_dir = os.getenv("INDEXTTS2_MODEL_DIR", "checkpoints")
        use_fp16 = os.getenv("INDEXTTS2_USE_FP16", "false").lower() == "true"
        use_cuda_kernel = os.getenv("INDEXTTS2_USE_CUDA_KERNEL", "false").lower() == "true"
        use_deepspeed = os.getenv("INDEXTTS2_USE_DEEPSPEED", "false").lower() == "true"

        try:
            self._model = IndexTTS2(
                cfg_path=cfg_path,
                model_dir=model_dir,
                use_fp16=use_fp16,
                use_cuda_kernel=use_cuda_kernel,
                use_deepspeed=use_deepspeed,
            )
        except Exception as exc:  # pragma: no cover - model load depends on runtime env
            raise TTSServiceError(
                "Failed to initialize IndexTTS2. Verify checkpoints path, CUDA setup, and model files."
            ) from exc

        return self._model

    def infer(self, text: str, voice_ref_path: str, output_path: str, emo_audio_prompt: Optional[str] = None) -> None:
        model = self._load()
        kwargs = {
            "spk_audio_prompt": voice_ref_path,
            "text": text,
            "output_path": output_path,
            "verbose": False,
        }
        if emo_audio_prompt:
            kwargs["emo_audio_prompt"] = emo_audio_prompt

        try:
            model.infer(**kwargs)
        except Exception as exc:  # pragma: no cover - runtime inference depends on env
            raise TTSServiceError("IndexTTS2 inference failed.") from exc


_ENGINE = _IndexTTS2Engine()


def _stub_synthesize(voice_ref_path: str, output_path: str) -> None:
    """Development fallback: copies prompt audio as placeholder output."""
    shutil.copy2(voice_ref_path, output_path)


def synthesize(text: str, voice_ref_path: str, output_path: str, emo_audio_prompt: Optional[str] = None) -> None:
    """Synthesize speech using configured provider.

    Env:
    - TTS_PROVIDER: "stub" (default) or "indextts2"
    """
    provider = os.getenv("TTS_PROVIDER", "stub").strip().lower()
    logger.info(f"TTS_PROVIDER={provider}")
    if provider == "stub":
        logger.info("Using stub synthesizer")
        _stub_synthesize(voice_ref_path, output_path)
        return
    if provider == "indextts2":
        logger.info("Using IndexTTS2 synthesizer")
        _ENGINE.infer(text=text, voice_ref_path=voice_ref_path, output_path=output_path, emo_audio_prompt=emo_audio_prompt)
        return

    raise TTSServiceError(f"Unsupported TTS_PROVIDER: {provider}")
