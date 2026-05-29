$ErrorActionPreference = "Stop"
$apiDir = Join-Path $PSScriptRoot "..\ml-forecast-api"
$env:API_KEY = if ($env:API_KEY) { $env:API_KEY } else { "mkt-bi-ia-dev-key" }

$py = Join-Path $apiDir ".venv\Scripts\python.exe"
if (-not (Test-Path $py)) {
  Write-Host "Creating venv..."
  python -m venv (Join-Path $apiDir ".venv")
  & (Join-Path $apiDir ".venv\Scripts\pip.exe") install -r (Join-Path $apiDir "requirements.txt")
}

Write-Host "Starting ML API on http://127.0.0.1:8000 (API_KEY=$env:API_KEY)"
Set-Location $apiDir
& $py -m uvicorn app:app --host 127.0.0.1 --port 8000
