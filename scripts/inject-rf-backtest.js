/**
 * Inyecta predicciones ML (compare: RF/LGBM/AutoETS) en dashboard_payload.json.
 * Compara MASE baseline (solo lags) vs enriquecido (spend + changepoint).
 *
 * Uso:  node scripts/inject-rf-backtest.js
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const API_BASE = process.env.ML_API_BASE_URL || 'http://127.0.0.1:8000';
const API_KEY = process.env.API_KEY || 'mkt-bi-ia-dev-key';
const PAYLOAD = path.join(__dirname, '..', 'data', 'dashboard_payload.json');

function postPredict(body) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_BASE.replace(/\/$/, '')}/predict`);
    const payload = JSON.stringify(body);
    const req = http.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'X-API-Key': API_KEY,
        },
        timeout: 180000,
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
    req.write(payload);
    req.end();
  });
}

function buildSpendMap(payload) {
  const map = {};
  const campaigns = payload.investment?.campaigns || [];
  campaigns.forEach((c) => {
    (c.daily || c.series || []).forEach((d) => {
      const date = String(d.date || d.fecha || '').split('T')[0];
      if (!date) return;
      map[date] = (map[date] || 0) + (parseFloat(d.spend) || 0);
    });
  });
  return map;
}

async function main() {
  const payload = JSON.parse(fs.readFileSync(PAYLOAD, 'utf-8'));
  const baseTs =
    (payload.forecast_rf && Array.isArray(payload.forecast_rf.time_series) && payload.forecast_rf.time_series.length
      ? payload.forecast_rf.time_series
      : (payload.forecast && payload.forecast.time_series) || []);

  if (!baseTs.length) throw new Error('No se encontro time_series en el payload');

  const spendMap = buildSpendMap(payload);
  const changepoint = payload.forecast?.changepoint || { detected: false };
  const series = baseTs.map((d) => ({
    date: d.date,
    value: d.value,
    spend: spendMap[String(d.date).split('T')[0]] || d.spend || 0,
  }));
  const backtestDays = Math.max(14, series.length - 15);

  console.log(`Enviando ${series.length} puntos (con spend) a ${API_BASE}/predict ...`);

  const [baseline, enriched, compare] = await Promise.all([
    postPredict({ series: series.map(({ date, value }) => ({ date, value })), backtest_days: backtestDays, model: 'random_forest' }),
    postPredict({ series, backtest_days: backtestDays, model: 'random_forest', changepoint }),
    postPredict({ series, backtest_days: backtestDays, model: 'compare', changepoint }),
  ]);

  console.log('MASE RF baseline (solo lags):', baseline.mase);
  console.log('MASE RF + spend + changepoint:', enriched.mase);
  console.log('MASE compare winner:', compare.model_name, compare.mase);
  if (compare.diagnostics?.all_mase) {
    console.log('MASE por modelo:', compare.diagnostics.all_mase);
  }

  payload.forecast_rf = payload.forecast_rf || {};
  payload.forecast_rf.available = true;
  payload.forecast_rf.model_name = compare.model_name || 'random_forest';
  payload.forecast_rf.recommended_value = compare.recommended_value;
  payload.forecast_rf.mase = compare.mase;
  payload.forecast_rf.confidence = compare.confidence || null;
  payload.forecast_rf.mode = compare.mode || null;
  payload.forecast_rf.label = compare.label || null;
  payload.forecast_rf.horizons = compare.forecast_horizons || payload.forecast_rf.horizons || {};
  payload.forecast_rf.backtest_models = (compare.backtest && compare.backtest.models) || [];
  payload.forecast_rf.backtest_series = compare.backtest_series || [];
  payload.forecast_rf.next_point = compare.next_point || null;
  payload.forecast_rf.time_series = baseTs;
  payload.forecast_rf.validation = {
    rf_baseline_mase: baseline.mase,
    rf_enriched_mase: enriched.mase,
    improvement_pct: baseline.mase > 0 ? Math.round((1 - enriched.mase / baseline.mase) * 1000) / 10 : null,
  };

  fs.writeFileSync(PAYLOAD, JSON.stringify(payload, null, 2));
  console.log('Payload actualizado:', PAYLOAD);
}

main().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
