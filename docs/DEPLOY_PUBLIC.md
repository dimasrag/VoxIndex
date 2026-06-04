# Public Deployment Guide (Keep the GPU on Your PC)

This guide assumes:
- Frontend deployed to Vercel
- Backend kept running on your own Windows PC with Docker Desktop + WSL2 + NVIDIA GPU
- Backend exposed publicly with Cloudflare Tunnel

## 1) Backend env on your PC

Edit `backend/.env` (or set the same values in Docker Compose) so CORS allows your deployed frontend:

```env
FRONTEND_ORIGINS=http://localhost:5173,https://your-frontend.vercel.app
TTS_PROVIDER=indextts2
INDEXTTS2_CONFIG_PATH=/checkpoints/config.yaml
INDEXTTS2_MODEL_DIR=/checkpoints
INDEXTTS2_FEATURE_EXTRACTOR_DIR=/checkpoints/w2v-bert-2.0-feature-extractor
```

Restart the backend after changes:

```powershell
cd 'D:\!Codes\Indextts\VoxIndex'
docker compose up -d backend
```

## 2) Expose backend with Cloudflare Tunnel

Install `cloudflared` and create a tunnel that forwards to `http://localhost:8000`.

Quick test tunnel:

```powershell
cloudflared tunnel --url http://localhost:8000
```

For a permanent tunnel, create a named tunnel and map it to a hostname in your Cloudflare DNS.

Your public backend URL will look like:

```text
https://api.yourdomain.com
```

## 3) Deploy frontend to Vercel

In your frontend project, set:

```env
VITE_API_URL=https://api.yourdomain.com/api
```

Then deploy the frontend repo to Vercel. If you use Vercel CLI:

```powershell
cd 'D:\!Codes\Indextts\VoxIndex\frontend'
vercel login
vercel
```

Or connect the repo in the Vercel dashboard and set `VITE_API_URL` in Project Settings -> Environment Variables.

## 4) Test the public flow

After deployment:
- Open the Vercel frontend URL
- Register/login
- Upload a voice reference
- Run synthesis

## 5) Security notes

- Keep `SECRET_KEY` long and random.
- Do not expose the backend without HTTPS.
- If you only want private access, lock the tunnel down with Cloudflare Access.
