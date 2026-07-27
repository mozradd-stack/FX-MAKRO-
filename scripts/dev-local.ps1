# One-command local dev for Windows: Firestore emulator + seed + API + frontend.
# Opens three PowerShell windows (one per process) and your browser once ready.
# Run from the repo root with:  powershell -ExecutionPolicy Bypass -File scripts\dev-local.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

function Wait-ForPort($port, $label) {
    Write-Host "Waiting for $label on port $port..."
    while (-not (Test-NetConnection -ComputerName "localhost" -Port $port -InformationLevel Quiet -WarningAction SilentlyContinue)) {
        Start-Sleep -Seconds 2
    }
    Write-Host "$label is up."
}

Write-Host "Starting Firestore emulator..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npx firebase-tools emulators:start --only firestore --project fx-makro-app"
Wait-ForPort 8080 "Firestore emulator"

Write-Host "Seeding (skips automatically if already seeded)..."
Push-Location "$root\functions"
$env:FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080"
$env:GCLOUD_PROJECT = "fx-makro-app"
npm run seed
Pop-Location

Write-Host "Starting API on http://localhost:4001 ..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\functions'; `$env:FIRESTORE_EMULATOR_HOST='127.0.0.1:8080'; `$env:GCLOUD_PROJECT='fx-makro-app'; npm run dev"
Wait-ForPort 4001 "API"

Write-Host "Starting frontend on http://localhost:5173 ..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\client'; npm run dev"
Wait-ForPort 5173 "Frontend"

Start-Process "http://localhost:5173"
Write-Host "Done. Three PowerShell windows are running the stack — close them to stop it."
