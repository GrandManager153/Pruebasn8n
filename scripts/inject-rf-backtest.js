/**
 * Inyecta las predicciones reales del Random Forest (backtest dia-a-dia + punto
 * del dia siguiente) dentro de data/dashboard_payload.json, usando la serie
 * historica real del propio payload. Util para ver en el dashboard local la
 * comparacion predicho-vs-real del RF sin depender de n8n.
 *
 * Uso:  node scripts/inject-rf-backtest.js
 * Env:  ML_API_BASE_URL (default http://127.0.0.1:8000)  API_KEY (default mkt-bi-ia-dev-key)
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const API_BASE = process.env.ML_API_BASE_URL || 'http://127.0.0.1:8000';
const API_KEY = process.env.API_KEY || 'mkt-bi-ia-dev-key';
const PAYLOAD = path.join(__dirname, '..', 'data', 'dashboard_payload.json');

function postPredict(series) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_BASE.replace(/\/$/, '')}/predict`);
    const backtestDays = Math.max(14, series.length - 15);
    const body = JSON.stringify({ series, backtest_days: backtestDays, model: 'random_forest' });
    const req = http.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          'X-API-Key': API_KEY,
        },
        timeout: 120000,
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            resolve(json);
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.write(body);
    req.end();
  });
}

async function main() {
  const payload = JSON.parse(fs.readFileSync(PAYLOAD, 'utf-8'));
  // Preferimos la serie propia del Random Forest para reproducir su MASE real
  // (la serie base puede ser otra distinta y daria un MASE diferente).
  const baseTs =
    (payload.forecast_rf && Array.isArray(payload.forecast_rf.time_series) && payload.forecast_rf.time_series.length
      ? payload.forecast_rf.time_series
      : (payload.forecast && payload.forecast.time_series) || []);

  if (!baseTs.length) throw new Error('No se encontro time_series en el payload');

  const series = baseTs.map((d) => ({ date: d.date, value: d.value }));
  console.log(`Enviando ${series.length} puntos a ${API_BASE}/predict ...`);

  const pred = await postPredict(series);
  console.log('MASE devuelto por el API:', pred.mase);
  console.log('Predicciones de backtest:', Array.isArray(pred.backtest_series) ? pred.backtest_series.length : 0);
  console.log('Punto del dia siguiente:', JSON.stringify(pred.next_point));

  payload.forecast_rf = payload.forecast_rf || {};
  payload.forecast_rf.available = true;
  payload.forecast_rf.model_name = pred.model_name || 'random_forest';
  payload.forecast_rf.recommended_value = pred.recommended_value;
  payload.forecast_rf.mase = pred.mase;
  payload.forecast_rf.horizons = pred.forecast_horizons || payload.forecast_rf.horizons || {};
  payload.forecast_rf.backtest_models = (pred.backtest && pred.backtest.models) || payload.forecast_rf.backtest_models || [];
  payload.forecast_rf.backtest_series = pred.backtest_series || [];
  payload.forecast_rf.next_point = pred.next_point || null;
  payload.forecast_rf.time_series = baseTs;

  fs.writeFileSync(PAYLOAD, JSON.stringify(payload, null, 2));
  console.log('Payload actualizado:', PAYLOAD);
}

main().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
