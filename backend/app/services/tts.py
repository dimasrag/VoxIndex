import os
import shutil
import logging
import sys
from threading import RLock
from typing import Optional

logger = logging.getLogger(__name__)


def _env_float(name: str, default: float) -> float:
    value = os.getenv(name)
    if value is None or value.strip() == "":
        return default
    try:
        return float(value)
    except ValueError:
        return default


def _env_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None or value.strip() == "":
        return default
    try:
        return int(value)
    except ValueError:
        return default


def _env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None or value.strip() == "":
        return default
    return value.strip().lower() == "true"

class TTSServiceError(Exception):
    """Raised when synthesis cannot be completed due to runtime/configuration issues."""


_CONFUCIUS_SUPPORTED_LANGUAGES = {
    "zh",
    "en",
    "ja",
    "ko",
    "de",
    "fr",
    "es",
    "id",
    "it",
    "th",
    "pt",
    "ru",
    "ms",
    "vi",
}


def _normalize_language_code(language: Optional[str]) -> str:
    normalized = (language or "en").strip().lower().replace("_", "-")
    if normalized in {"zh-cn", "zh-hans", "zh-hant"}:
        return "zh-cn"
    return normalized


def _normalize_confucius_language(language: Optional[str]) -> str:
    normalized = _normalize_language_code(language)
    if normalized == "zh-cn":
        return "zh"
    if normalized == "ms-my":
        return "ms"
    return normalized


class _IndexTTS2Engine:
    """Lazy-loaded wrapper around IndexTTS2 model initialization and inference."""

    def __init__(self) -> None:
        self._model = None
        self._lock = RLock()

    def _load(self):
        with self._lock:
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

            cfg_abs_path = os.path.abspath(cfg_path)
            model_dir_abs_path = os.path.abspath(model_dir)
            logger.info(
                "Initializing IndexTTS2 with cfg_path=%s (exists=%s), model_dir=%s (exists=%s), fp16=%s, cuda_kernel=%s, deepspeed=%s",
                cfg_abs_path,
                os.path.exists(cfg_abs_path),
                model_dir_abs_path,
                os.path.exists(model_dir_abs_path),
                use_fp16,
                use_cuda_kernel,
                use_deepspeed,
            )

            try:
                self._model = IndexTTS2(
                    cfg_path=cfg_path,
                    model_dir=model_dir,
                    use_fp16=use_fp16,
                    use_cuda_kernel=use_cuda_kernel,
                    use_deepspeed=use_deepspeed,
                )
            except Exception as exc:  # pragma: no cover - model load depends on runtime env
                logger.exception("IndexTTS2 initialization failed.")
                raise TTSServiceError(
                    f"Failed to initialize IndexTTS2. Verify checkpoints path, CUDA setup, and model files. Underlying error: {exc!r}"
                ) from exc

            return self._model

    def infer(self, text: str, voice_ref_path: str, output_path: str,
              emo_audio_prompt: Optional[str] = None,
              emo_vector: Optional[list] = None,
              emo_alpha: float = 1.0,
              use_emo_text: bool = False,
              emo_text: Optional[str] = None,
              use_random: bool = False,
              language: Optional[str] = None,
              max_text_tokens_per_segment: int = 160,
              interval_silence: int = 200) -> None:
        
        with self._lock:
            model = self._load()
            kwargs = {
                "spk_audio_prompt": voice_ref_path,
                "text": text,
                "output_path": output_path,
                "verbose": False,
            }
            # Add optional emotion parameters
            if emo_audio_prompt:
                kwargs["emo_audio_prompt"] = emo_audio_prompt
            if emo_vector is not None:
                kwargs["emo_vector"] = emo_vector
            if emo_alpha != 1.0:
                kwargs["emo_alpha"] = emo_alpha
            if use_emo_text:
                kwargs["use_emo_text"] = use_emo_text
            if emo_text:
                kwargs["emo_text"] = emo_text
            if use_random:
                kwargs["use_random"] = use_random
            kwargs["max_text_tokens_per_segment"] = max_text_tokens_per_segment
            if interval_silence != 200:
                kwargs["interval_silence"] = interval_silence

            try:
                model.infer(**kwargs)
            except Exception as exc:  # pragma: no cover - runtime inference depends on env
                raise TTSServiceError("IndexTTS2 inference failed.") from exc


class _Confucius4Engine:
    """Lazy-loaded wrapper around Confucius4-TTS multilingual voice cloning."""

    def __init__(self) -> None:
        self._model = None
        self._lock = RLock()

    def _load(self):
        with self._lock:
            if self._model is not None:
                return self._model

            try:
                confucius_repo_path = os.getenv("CONFUCIUS4_REPO_PATH", "../confucius4-tts")
                confucius_repo_abs_path = os.path.abspath(confucius_repo_path)
                if os.path.isdir(confucius_repo_abs_path) and confucius_repo_abs_path not in sys.path:
                    sys.path.insert(0, confucius_repo_abs_path)

                import torch
                from confuciustts.cli.inference import ConfuciusTTS
            except Exception as exc:  # pragma: no cover - import failure depends on runtime env
                raise TTSServiceError(
                    "Confucius4-TTS is not available. Clone the official Confucius4-TTS repo next to this app or set CONFUCIUS4_REPO_PATH, then point CONFUCIUS4_CONFIG_PATH and CONFUCIUS4_T2S_CHECKPOINT at the local files."
                ) from exc

            config_path = os.getenv("CONFUCIUS4_CONFIG_PATH", "../confucius4-tts/config/inference_config.yaml")
            t2s_checkpoint = os.getenv("CONFUCIUS4_T2S_CHECKPOINT") or None
            device = os.getenv(
                "CONFUCIUS4_DEVICE",
                "cuda" if torch.cuda.is_available() else "cpu",
            )
            config_abs_path = os.path.abspath(config_path)
            logger.info(
                "Initializing Confucius4-TTS with config_path=%s (exists=%s), t2s_checkpoint=%s, device=%s",
                config_abs_path,
                os.path.exists(config_abs_path),
                t2s_checkpoint,
                device,
            )

            try:
                self._model = ConfuciusTTS(
                    config_path=config_path,
                    t2s_checkpoint=t2s_checkpoint,
                    device=device,
                )
            except Exception as exc:  # pragma: no cover - runtime inference depends on env
                logger.exception("Confucius4-TTS initialization failed.")
                raise TTSServiceError(
                    f"Failed to initialize Confucius4-TTS. Verify the config path, checkpoints, and runtime dependencies. Underlying error: {exc!r}"
                ) from exc

            return self._model

    def infer(self, text: str, voice_ref_path: str, output_path: str, language: Optional[str] = None) -> None:
        with self._lock:
            model = self._load()
            target_language = _normalize_confucius_language(language or os.getenv("CONFUCIUS4_DEFAULT_LANGUAGE", "id"))

            generation_kwargs = {
                "temperature": _env_float("CONFUCIUS4_TEMPERATURE", 0.8),
                "top_p": _env_float("CONFUCIUS4_TOP_P", 0.8),
                "top_k": _env_int("CONFUCIUS4_TOP_K", 30),
                "num_beams": _env_int("CONFUCIUS4_NUM_BEAMS", 3),
                "repetition_penalty": _env_float("CONFUCIUS4_REPETITION_PENALTY", 10.0),
                "max_length": _env_int("CONFUCIUS4_MAX_LENGTH", 1520),
                "n_timesteps": _env_int("CONFUCIUS4_N_TIMESTEPS", 25),
                "inference_cfg_rate": _env_float("CONFUCIUS4_INFERENCE_CFG_RATE", 0.7),
                "max_text_tokens_per_segment": _env_int("CONFUCIUS4_MAX_TEXT_TOKENS_PER_SEGMENT", 80),
                "cross_fade_duration": _env_float("CONFUCIUS4_CROSS_FADE_DURATION", 0.3),
                "edge_fade_duration": _env_float("CONFUCIUS4_EDGE_FADE_DURATION", 0.1),
                "edge_pad_duration": _env_float("CONFUCIUS4_EDGE_PAD_DURATION", 0.1),
                "verbose": _env_bool("CONFUCIUS4_VERBOSE", False),
            }

            try:
                import torchaudio

                audio = model.generate(
                    text=text,
                    lang=target_language,
                    prompt_wav=voice_ref_path,
                    **generation_kwargs,
                )
                torchaudio.save(output_path, audio.cpu(), model.sample_rate)
            except Exception as exc:  # pragma: no cover - runtime inference depends on env
                raise TTSServiceError("Confucius4-TTS inference failed.") from exc


_ENGINE = _IndexTTS2Engine()
_CONFUCIUS_ENGINE = _Confucius4Engine()


def _is_english_language(language: Optional[str]) -> bool:
    normalized = _normalize_language_code(language)
    return normalized.startswith("en")


def _supports_confucius_language(language: Optional[str]) -> bool:
    normalized = _normalize_confucius_language(language)
    return normalized in _CONFUCIUS_SUPPORTED_LANGUAGES


def warmup() -> None:
    """Force model initialization without running inference."""
    provider = os.getenv("TTS_PROVIDER", "indextts2").strip().lower()
    if provider == "auto":
        _ENGINE._load()
        try:
            _CONFUCIUS_ENGINE._load()
        except TTSServiceError:
            # Keep the backend usable even if the multilingual model is not ready yet.
            pass
        return
    if provider == "confucius4":
        _CONFUCIUS_ENGINE._load()
        return
    _ENGINE._load()


def _stub_synthesize(voice_ref_path: str, output_path: str) -> None:
    """Development fallback: copies prompt audio as placeholder output."""
    shutil.copy2(voice_ref_path, output_path)


def synthesize(text: str, voice_ref_path: str, output_path: str,
               language: Optional[str] = None,
               emo_audio_prompt: Optional[str] = None,
               emo_vector: Optional[list] = None,
               emo_alpha: float = 1.0,
               use_emo_text: bool = False,
               emo_text: Optional[str] = None,
               use_random: bool = False,
               max_text_tokens_per_segment: int = 160,
               interval_silence: int = 200) -> None:
    
    """Synthesize speech using configured provider.

    Env:
    - TTS_PROVIDER: "indextts2" (default), "confucius4", "auto", or "stub"

    Provider behavior:
    - stub: always placeholder audio
    - indextts2/auto: English uses IndexTTS2, Indonesian and other Confucius4-supported languages use Confucius4-TTS, other non-English languages fall back to IndexTTS2
    - confucius4: always Confucius4-TTS
    """
    provider = os.getenv("TTS_PROVIDER", "indextts2").strip().lower()
    logger.info(f"TTS_PROVIDER={provider}")
    if provider == "stub":
        logger.info("Using stub synthesizer")
        _stub_synthesize(voice_ref_path, output_path)
        return

    if provider == "confucius4":
        logger.info("Using Confucius4-TTS synthesizer")
        _CONFUCIUS_ENGINE.infer(
            text=text,
            voice_ref_path=voice_ref_path,
            output_path=output_path,
            language=language,
        )
        return
    
    if provider in {"indextts2", "auto"}:
        if _is_english_language(language):
            logger.info("Using IndexTTS2 synthesizer for English text")
            _ENGINE.infer(
                text=text,
                voice_ref_path=voice_ref_path,
                output_path=output_path,
                emo_audio_prompt=emo_audio_prompt,
                emo_vector=emo_vector,
                emo_alpha=emo_alpha,
                use_emo_text=use_emo_text,
                emo_text=emo_text,
                use_random=use_random,
                language=language,
                max_text_tokens_per_segment=max_text_tokens_per_segment,
                interval_silence=interval_silence,
            )
            return

        if _supports_confucius_language(language):
            logger.info("Trying Confucius4-TTS synthesizer for non-English text")
            _CONFUCIUS_ENGINE.infer(
                text=text,
                voice_ref_path=voice_ref_path,
                output_path=output_path,
                language=language,
            )
            return

        logger.info("Falling back to IndexTTS2 synthesizer for non-English text")
        _ENGINE.infer(
            text=text,
            voice_ref_path=voice_ref_path,
            output_path=output_path,
            emo_audio_prompt=emo_audio_prompt,
            emo_vector=emo_vector,
            emo_alpha=emo_alpha,
            use_emo_text=use_emo_text,
            emo_text=emo_text,
            use_random=use_random,
            language=language,
            max_text_tokens_per_segment=max_text_tokens_per_segment,
            interval_silence=interval_silence,
        )
        return

    raise TTSServiceError(f"Unsupported TTS_PROVIDER: {provider}")
