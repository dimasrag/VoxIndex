import shutil

def synthesize(text: str, voice_ref_path: str, output_path: str) -> None:
    """Stub TTS synthesizer. Copies voice ref as placeholder output for IndexTTS2."""
    shutil.copy2(voice_ref_path, output_path)
