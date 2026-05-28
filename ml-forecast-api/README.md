# ML Forecast API (Random Forest)

API local para predicciones de volumen diario de leads (Random Forest).

## Instalación

```powershell
cd ml-forecast-api
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

## Arrancar

```powershell
$env:API_KEY = "mkt-bi-ia-dev-key"
uvicorn app:app --host 127.0.0.1 --port 8000
```

Probar: http://127.0.0.1:8000/health

## n8n Cloud

Exponer con ngrok (`ngrok http 8000`) y configurar en n8n (Settings → Variables):

- `ML_API_BASE_URL` = URL HTTPS de ngrok del puerto 8000 (sin `/predict`)
- `WEBHOOK_BASE_URL` = URL HTTPS de ngrok del puerto 3000 (sin `/api/webhook`)

Usar `$vars`, no `$env` (n8n Cloud bloquea variables de entorno).
- Credencial Header Auth `X-API-Key` = mismo valor que `API_KEY`
