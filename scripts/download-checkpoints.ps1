Param(
    [string]$HfRepo = "IndexTeam/IndexTTS-2",
    [string]$Dest = "..\index-tts\checkpoints"
)

Write-Output "Downloading checkpoints from $HfRepo to $Dest"

if (-not (Get-Command hf -ErrorAction SilentlyContinue)) {
    Write-Error "The 'hf' CLI is not installed. Install it with: pip install huggingface_hub"
    exit 1
}

if (-not (Test-Path $Dest)) { New-Item -ItemType Directory -Path $Dest | Out-Null }

hf download $HfRepo --local-dir $Dest
Write-Output "Download complete. Update backend/.env to point INDEXTTS2_MODEL_DIR to the checkpoints path."
