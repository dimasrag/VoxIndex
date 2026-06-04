Docker setup for IndexTTS2 (local GPU, WSL2/Docker Desktop)

Quick steps

1. Ensure Docker Desktop WSL integration is enabled (you already did).
2. Create these host folders on the `S:` drive if they don't exist:
   - `S:\indextts\checkpoints`
   - `S:\indextts\hf_cache`
   - `S:\indextts\outputs`

3. Adjust `docker-compose.yml` volume host paths if your folders differ.

4. Build and start the backend (from project root):

```powershell
docker compose build --progress=plain backend
docker compose up -d backend
```

5. Check logs and health:

```powershell
docker compose logs -f backend
docker compose ps
```

Notes
- The compose file mounts host `S:/...` folders into the container — this keeps large HF checkpoints and cache off of C:.
- If you prefer WSL paths, replace `S:/...` in `docker-compose.yml` with the equivalent `/mnt/s/...` paths.
- The container uses the host GPU via `device_requests` (Docker Desktop + NVIDIA WSL driver required).

Pre-downloading HF models
-------------------------
To pre-download Hugging Face model repos into `S:/indextts`, use the helper script `scripts/download_hf_artifacts.py`.

1. Edit `scripts/models_to_download.json` and replace the placeholder `repo_id` values with the HF repo IDs you need.
2. (Optional) Export your HF token if the model is private:

```powershell
$env:HF_TOKEN = "<your_token>"
```

3. Run the downloader (Windows PowerShell):

```powershell
python .\scripts\download_hf_artifacts.py --config .\scripts\models_to_download.json
```

The script will copy files into the `S:` destinations you specified.
