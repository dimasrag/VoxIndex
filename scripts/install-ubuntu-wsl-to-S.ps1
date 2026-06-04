<#
install-ubuntu-wsl-to-S.ps1

Run as Administrator. Downloads an Ubuntu Jammy rootfs to S:\wsl and imports it
as a WSL2 distro stored on S: (avoids C: usage). The script will optionally
unregister an existing "Ubuntu" distro if present.

Usage (Admin PowerShell):
  Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
  .\scripts\install-ubuntu-wsl-to-S.ps1

Notes:
- Requires internet and sufficient space on S: (recommended >= 10 GB free).
- After import run `wsl -d Ubuntu` to finish distro setup (create user, sudo).
#>

param(
    [string]$TargetRoot = "S:\\wsl",
    [string]$DistroName = "Ubuntu",
    [string]$RootfsFileName = "jammy-rootfs.tar.xz",
    [switch]$NonInteractive
)

function Ensure-Admin {
    $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $isAdmin) {
        Write-Error "Please run this script as Administrator."
        exit 1
    }
}

function Prompt-YesNo($msg, $defaultYes = $true) {
    if ($NonInteractive) { return $true }
    $yn = Read-Host "$msg $([char]0x0A)Type y for yes, n for no"
    if ([string]::IsNullOrWhiteSpace($yn)) { return $defaultYes }
    return ($yn -match '^[Yy]')
}

Ensure-Admin

# Ensure target root exists
if (-not (Test-Path $TargetRoot)) { New-Item -Path $TargetRoot -ItemType Directory -Force | Out-Null }

$TarPath = Join-Path $TargetRoot $RootfsFileName
$ImportDir = Join-Path $TargetRoot $DistroName
$RootfsUrl = 'https://cloud-images.ubuntu.com/jammy/current/jammy-server-cloudimg-amd64-root.tar.xz'

Write-Host "Target root for WSL import: $TargetRoot"

# If a distro exists with the same name, ask/unregister
$existing = & wsl --list --quiet 2>$null | ForEach-Object { $_.Trim() } | Where-Object { $_ -eq $DistroName }
if ($existing) {
    Write-Host "A WSL distro named '$DistroName' already exists."
    if (Prompt-YesNo "Unregister (remove) and replace it? (this deletes the existing distro)") {
        Write-Host "Unregistering existing distro '$DistroName'..."
        wsl --unregister $DistroName
    } else {
        Write-Host "Aborting by user choice."; exit 0
    }
}

# Download rootfs if not present
if (Test-Path $TarPath) {
    Write-Host "Rootfs archive already exists at $TarPath. Skipping download."
} else {
    Write-Host "Downloading Ubuntu Jammy rootfs to: $TarPath"
    try {
        Invoke-WebRequest -Uri $RootfsUrl -OutFile $TarPath -UseBasicParsing -ErrorAction Stop
    } catch {
        Write-Error "Download failed: $_`nIf the URL is unreachable, open https://cloud-images.ubuntu.com/jammy/current/ in a browser and pick a rootfs tar.xz file."
        exit 1
    }
}

# Import into WSL (creates distro files under $ImportDir)
Write-Host "Importing distro as '$DistroName' into: $ImportDir"
try {
    wsl --import $DistroName $ImportDir $TarPath --version 2
} catch {
    Write-Error "wsl --import failed: $_"
    exit 1
}

Write-Host "Import completed successfully. You can now run: wsl -d $DistroName"

if (Prompt-YesNo "Remove downloaded archive $TarPath to free space?") {
    try {
        Remove-Item $TarPath -Force
        Write-Host "Removed $TarPath"
    } catch {
        Write-Warning ("Failed to remove {0}: {1}" -f $TarPath, $_)
    }
}

Write-Host "Done. Next steps:`n  wsl -d $DistroName`n  Inside WSL: sudo apt update && sudo apt upgrade -y`n  Install Docker Desktop and NVIDIA Windows drivers, then verify GPU access from WSL.`n"
