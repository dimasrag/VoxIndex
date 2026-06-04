#!/usr/bin/env python3
"""Warm up the backend + IndexTTS2 model.

Steps:
- Register a temporary user
- Login to get a bearer token
- Create a 1s silent WAV and upload as a voice ref
- Request a short synthesis to force the model to initialize
- Poll the job until completion (or timeout)

Run:
  python scripts/warmup.py --base http://127.0.0.1:8000

Requires: `requests` (pip install requests)
"""
import argparse
import os
import time
import wave
import requests


def make_silent_wav(path, duration_s=1.0, rate=16000):
    n_frames = int(duration_s * rate)
    with wave.open(path, 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(rate)
        wf.writeframes(b'\x00\x00' * n_frames)


def register(base, username, password, email):
    url = f"{base}/api/auth/register"
    payload = {"username": username, "email": email, "password": password}
    r = requests.post(url, json=payload)
    r.raise_for_status()
    return r.json()


def login(base, username, password):
    url = f"{base}/api/auth/login"
    r = requests.post(url, data={"username": username, "password": password})
    r.raise_for_status()
    return r.json()["access_token"]


def upload_voice_ref(base, token, wav_path):
    url = f"{base}/api/voice-refs/upload"
    headers = {"Authorization": f"Bearer {token}"}
    with open(wav_path, 'rb') as f:
        files = {"file": (os.path.basename(wav_path), f, "audio/wav")}
        r = requests.post(url, headers=headers, files=files)
    r.raise_for_status()
    return r.json()["id"]


def request_synthesis(base, token, voice_ref_id, text="Hello world"):
    url = f"{base}/api/synthesis"
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    payload = {"voice_ref_id": voice_ref_id, "text": text}
    r = requests.post(url, headers=headers, json=payload)
    r.raise_for_status()
    return r.json()


def warmup_engine(base, token):
    url = f"{base}/api/synthesis/warmup"
    headers = {"Authorization": f"Bearer {token}"}
    r = requests.post(url, headers=headers)
    r.raise_for_status()
    return r.json()


def poll_jobs(base, token, interval=5, timeout=600):
    url = f"{base}/api/synthesis"
    headers = {"Authorization": f"Bearer {token}"}
    start = time.time()
    while time.time() - start < timeout:
        r = requests.get(url, headers=headers)
        r.raise_for_status()
        jobs = r.json()
        if jobs:
            latest = jobs[0]
            print(f"Job {latest['id']} status={latest['status']}")
            if latest['status'] == 'completed':
                return latest
            if latest['status'] == 'failed':
                raise RuntimeError('Warmup job failed')
        time.sleep(interval)
    raise TimeoutError('Timed out waiting for warmup job')


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--base', default=os.environ.get('BACKEND_URL', 'http://127.0.0.1:8000'))
    p.add_argument('--username', default='warmup_user')
    p.add_argument('--email', default='warmup@example.com')
    p.add_argument('--password', default='warmup_password')
    args = p.parse_args()

    base = args.base.rstrip('/')

    print('Creating silent WAV...')
    tmp_wav = 'warmup_silence.wav'
    make_silent_wav(tmp_wav)

    print('Registering user...')
    try:
        register(base, args.username, args.password, args.email)
    except requests.HTTPError as e:
        print('Register failed, continuing:', e)

    print('Logging in...')
    token = login(base, args.username, args.password)
    print('Got token, uploading voice ref...')
    vr_id = upload_voice_ref(base, token, tmp_wav)
    print('Uploaded voice ref id=', vr_id)

    print('Warming up TTS engine (model load only)...')
    warmup_result = warmup_engine(base, token)
    print('Warmup endpoint result:', warmup_result)

    print('Requesting a short synthesis (this should now be fast)...')
    job = request_synthesis(base, token, vr_id, text='Warmup run. Short sentence to initialize model.')
    print('Synthesis job created:', job)

    print('Polling for completion (this may take a while)...')
    result = poll_jobs(base, token, interval=10, timeout=1800)
    print('Warmup completed:', result)

    print('Done. You can delete the warmup user or voice ref if desired.')


if __name__ == '__main__':
    main()
