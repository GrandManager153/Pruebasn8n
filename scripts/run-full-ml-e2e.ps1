$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

Write-Host "=== Validar workflow JSON ==="
node (Join-Path $root "scripts\validate-workflow-ml.js")
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "`n=== Arrancar API (si no responde) ==="
$apiKey = if ($env:API_KEY) { $env:API_KEY } else { "mkt-bi-ia-dev-key" }
$env:API_KEY = $apiKey
$base = if ($env:ML_API_BASE_URL) { $env:ML_API_BASE_URL } else { "http://127.0.0.1:8000" }

try {
  Invoke-RestMethod -Uri "$base/health" -Method GET -TimeoutSec 3 | Out-Null
  Write-Host "API ya responde en $base"
} catch {
  Write-Host "Iniciando uvicorn..."
  $py = Join-Path $root "ml-forecast-api\.venv\Scripts\python.exe"
  Start-Process -WindowStyle Hidden -FilePath $py -ArgumentList "-m","uvicorn","app:app","--host","127.0.0.1","--port","8000" -WorkingDirectory (Join-Path $root "ml-forecast-api")
  Start-Sleep -Seconds 5
}

Write-Host "`n=== Simular flujo n8n + payload dashboard ==="
$env:ML_API_BASE_URL = $base
$env:API_KEY = $apiKey
node (Join-Path $root "scripts\simulate-hybrid-e2e.js")
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "`n=== OK ==="
Write-Host "Payload: $root\data\dashboard_payload.json"
Write-Host "Evidencia: $root\test-results\predictionV2-comparative.json"
