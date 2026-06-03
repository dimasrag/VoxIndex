#!/usr/bin/env python3
"""
Download Hugging Face model repositories (or subfolders) into host directories.

Usage:
  python scripts/download_hf_artifacts.py --config scripts/models_to_download.json

Config format (examples in scripts/models_to_download.json):
{
  "repos": [
    { "repo_id": "username/model-name", "subdir": "", "dest": "S:/indextts/checkpoints/model-name" }
  ]
}

The script uses the `huggingface_hub` Python package. Provide a token via
the `HF_TOKEN` or `HUGGINGFACE_TOKEN` environment variable if you need to
access private models.
"""
import os
import argparse
import json
import shutil
from huggingface_hub import snapshot_download


def download_entry(entry, token=None):
    """
    Entry can be either a HF repo entry (repo_id + optional subdir) or a
    local copy entry with `local_src` pointing to an existing folder.
    """
    repo_id = entry.get("repo_id")
    subdir = entry.get("subdir") or ""
    dest = entry.get("dest")
    local_src = entry.get("local_src")

    if local_src:
        # Copy from a local source path into dest
        if not dest:
            print(f"Skipping local entry without dest: {entry}")
            return
        if not os.path.exists(local_src):
            print(f"Local source not found: {local_src}")
            return
        os.makedirs(dest, exist_ok=True)
        if os.path.isfile(local_src):
            print(f"Copying local file {local_src} -> {dest}")
            shutil.copy2(local_src, os.path.join(dest, os.path.basename(local_src)))
            return

        print(f"Copying local folder {local_src} -> {dest}")
        for name in os.listdir(local_src):
            s = os.path.join(local_src, name)
            d = os.path.join(dest, name)
            if os.path.isdir(s):
                shutil.copytree(s, d, dirs_exist_ok=True)
            else:
                shutil.copy2(s, d)
        return

    if not repo_id or not dest:
        print(f"Skipping invalid entry: {entry}")
        return

    os.makedirs(dest, exist_ok=True)
    print(f"Downloading {repo_id} -> {dest} (subdir='{subdir}')")
    cached_path = snapshot_download(repo_id=repo_id, use_auth_token=token)

    src = os.path.join(cached_path, subdir) if subdir else cached_path
    if not os.path.exists(src):
        print(f"Warning: source path not found after download: {src}")
        return

    # Copy files into destination (merge)
    for name in os.listdir(src):
        s = os.path.join(src, name)
        d = os.path.join(dest, name)
        if os.path.isdir(s):
            shutil.copytree(s, d, dirs_exist_ok=True)
        else:
            shutil.copy2(s, d)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--config", default="scripts/models_to_download.json")
    p.add_argument("--token", default=os.environ.get("HF_TOKEN") or os.environ.get("HUGGINGFACE_TOKEN"))
    args = p.parse_args()

    if not os.path.exists(args.config):
        print(f"Config file not found: {args.config}")
        return

    with open(args.config, "r", encoding="utf8") as f:
        cfg = json.load(f)

    repos = cfg.get("repos", [])
    if not repos:
        print("No repos listed in config")
        return

    for entry in repos:
        try:
            download_entry(entry, token=args.token)
        except Exception as e:
            print(f"Failed to download {entry.get('repo_id')}: {e}")


if __name__ == "__main__":
    main()
