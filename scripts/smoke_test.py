import requests
import time
import os
import sys
import uuid

BASE = os.environ.get("BASE_URL", "http://127.0.0.1:8002")


def find_voice_ref():
    root = os.path.join(os.path.dirname(__file__), "..", "storage", "voice_refs")
    root = os.path.abspath(root)
    if not os.path.isdir(root):
        return None
    for fname in os.listdir(root):
        if fname.lower().endswith(('.mp3', '.wav', '.m4a', '.flac')):
            return os.path.join(root, fname)
    return None


def main():
    print('Base URL:', BASE)
    vf = find_voice_ref()
    if not vf:
        print('No voice ref file found under storage/voice_refs/. Please upload one or place a sample file there.')
        sys.exit(2)
    print('Using voice ref:', vf)

    username = f"smoke_{uuid.uuid4().hex[:8]}"
    email = f"{username}@example.com"
    pw = "smokepass"

    # Register
    r = requests.post(
        f"{BASE}/api/auth/register",
        json={"username": username, "email": email, "password": pw},
    )
    if r.status_code not in (200,201):
        print('Register failed:', r.status_code, r.text)
        # continue if already exists

    # Login
    r = requests.post(
        f"{BASE}/api/auth/login",
        data={"username": username, "password": pw},
    )
    if r.status_code != 200:
        print('Login failed:', r.status_code, r.text)
        sys.exit(3)
    token = r.json().get('access_token')
    print('Got token')
    headers = {"Authorization": f"Bearer {token}"}

    # Upload voice ref
    with open(vf, 'rb') as fh:
        files = {'file': (os.path.basename(vf), fh, 'application/octet-stream')}
        r = requests.post(f"{BASE}/api/voice-refs/upload", headers=headers, files=files)
    if r.status_code not in (200,201):
        print('Upload failed:', r.status_code, r.text)
        sys.exit(4)
    voice_ref = r.json()
    vid = voice_ref.get('id')
    print('Uploaded voice ref id:', vid)

    # Create synthesis job
    body = {"voice_ref_id": vid, "text": "Hello world from smoke test"}
    r = requests.post(f"{BASE}/api/synthesis/", headers=headers, json=body)
    if r.status_code not in (200,201):
        print('Create synthesis failed:', r.status_code, r.text)
        sys.exit(5)
    job = r.json()
    jid = job.get('id')
    print('Created job id:', jid)

    # Poll for completion
    deadline = time.time() + 600
    status = job.get('status')
    while time.time() < deadline and status != 'completed' and status != 'failed':
        time.sleep(3)
        r = requests.get(f"{BASE}/api/synthesis/", headers=headers)
        if r.status_code != 200:
            print('List jobs failed:', r.status_code, r.text)
            break
        jobs = r.json()
        for j in jobs:
            if j.get('id') == jid:
                status = j.get('status')
                print('Job status:', status)
                break
    if status != 'completed':
        print('Job did not complete, status:', status)
        sys.exit(6)

    # Download audio
    r = requests.get(f"{BASE}/api/synthesis/{jid}/audio", headers=headers, stream=True)
    if r.status_code != 200:
        print('Download failed:', r.status_code, r.text)
        sys.exit(7)
    outdir = os.path.join(os.path.dirname(__file__), '..', 'storage', 'outputs')
    os.makedirs(outdir, exist_ok=True)
    outpath = os.path.abspath(os.path.join(outdir, f'smoke_{jid}.wav'))
    with open(outpath, 'wb') as f:
        for chunk in r.iter_content(1024*8):
            if chunk:
                f.write(chunk)
    print('Saved output to', outpath)
    print('Smoke test succeeded')

if __name__ == '__main__':
    main()
