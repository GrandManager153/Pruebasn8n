/**
 * Simulates n8n ML branch: mock series -> POST /predict -> dual forecast payload shape.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const API_BASE = process.env.ML_API_BASE_URL || 'http://127.0.0.1:8000';
const API_KEY = process.env.API_KEY || 'mkt-bi-ia-dev-key';

function buildMockSeries(days = 42) {
  const series = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i - 1);
    series.push({
      date: d.toISOString().split('T')[0],
      value: 80 + Math.round(Math.sin(i / 5) * 15) + Math.floor(i / 3),
    });
  }
  return series;
}

function postPredict(payload) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_BASE.replace(/\/$/, '')}/predict`);
    const body = JSON.stringify(payload);
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
            if (res.statusCode >= 400) reject(new Error(JSON.stringify(json)));
            else resolve(json);
          } catch (e) {
            reject(new Error(`Invalid JSON (${res.statusCode}): ${data.slice(0, 200)}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.write(body);
    req.end();
  });
}

function buildLocalEngineStub(series) {
  const vals = series.map((s) => s.value);
  const n = vals.length;
  const last7 = vals.slice(-7);
  const mean7 = last7.reduce((a, b) => a + b, 0) / 7;
  const naiveMae =
    n >= 8
      ? vals.slice(-7).reduce((s, v, i) => s + Math.abs(v - vals[n - 7 + i]), 0) / 7
      : 1;
  const mae = Math.abs(vals[n - 1] - mean7);
  const mase = naiveMae > 0 ? mae / naiveMae : 1;
  const fc1d = Math.round(mean7);
  const horizons = {
    next_1d: { forecast: fc1d, band_low: 0, band_high: Math.round(mean7 * 1.2) },
    next_7d: { forecast: Math.round(mean7 * 7), band_low: 0, band_high: Math.round(mean7 * 7 * 1.2) },
    next_14d: { forecast: Math.round(mean7 * 14), band_low: 0, band_high: Math.round(mean7 * 14 * 1.2) },
  };
  const fourierFc = Math.round(mean7 * 1.05);
  return {
    mode: mase < 1 ? 'weak_model' : 'observed_fallback',
    model_name: 'mean_7d',
    recommended_value: fc1d,
    mase: Math.round(mase * 1000) / 1000,
    confidence: 'media',
    label: 'Local stub mean_7d',
    forecast_horizons: horizons,
    backtest: {
      models: [
        {
          name: 'mean_7d',
          mae: Math.round(mae * 100) / 100,
          mase: Math.round(mase * 1000) / 1000,
          rmse: mae,
          series: vals.slice(-14).map((v) => Math.round(v * 0.98)),
          forecast_1d: fc1d,
          horizons,
        },
        {
          name: 'fourier_regression',
          mae: Math.round(mae * 1.1 * 100) / 100,
          mase: Math.round(mase * 1.05 * 1000) / 1000,
          rmse: mae * 1.2,
          series: vals.slice(-14).map((v) => Math.round(v * 1.02)),
          forecast_1d: fourierFc,
          horizons: {
            next_1d: { forecast: fourierFc, band_low: 0, band_high: Math.round(fourierFc * 1.2) },
            next_7d: { forecast: fourierFc * 7, band_low: 0, band_high: Math.round(fourierFc * 7 * 1.2) },
            next_14d: { forecast: fourierFc * 14, band_low: 0, band_high: Math.round(fourierFc * 14 * 1.2) },
          },
        },
      ],
    },
    diagnostics: { best_model: 'mean_7d', best_mase: Math.round(mase * 1000) / 1000 },
    seasonal_indices: [1, 1, 1, 1, 1, 0.8, 0.7],
    changepoint: { detected: false },
  };
}

function buildDashboardPayload(localEngine, apiPred, timeSeries) {
  const linear = localEngine;
  const forecast = {
    recommended_value: linear.recommended_value,
    method: linear.model_name,
    mase: linear.diagnostics?.best_mase,
    horizons: linear.forecast_horizons,
    backtest_models: linear.backtest?.models || [],
    seasonal_indices: linear.seasonal_indices || [],
    changepoint: linear.changepoint || { detected: false },
    time_series: timeSeries,
  };
  let forecast_rf;
  if (!apiPred || apiPred.recommended_value == null) {
    forecast_rf = { available: false, reason: 'ML API no disponible', time_series: timeSeries };
  } else {
    forecast_rf = {
      available: true,
      model_name: apiPred.model_name,
      recommended_value: apiPred.recommended_value,
      mase: apiPred.mase,
      horizons: apiPred.forecast_horizons,
      backtest_models: apiPred.backtest?.models || [],
      backtest_series: apiPred.backtest_series || [],
      next_point: apiPred.next_point || null,
      time_series: timeSeries,
    };
  }
  return { forecast, forecast_rf };
}

async function main() {
  const series = buildMockSeries(42);
  const payload = { series, backtest_days: 14, model: 'random_forest' };

  const healthRes = await fetch(`${API_BASE.replace(/\/$/, '')}/health`).catch(() => null);
  if (!healthRes?.ok) throw new Error(`API not reachable at ${API_BASE}`);

  const apiPred = await postPredict(payload);
  const localEngine = buildLocalEngineStub(series);
  const dashboard = buildDashboardPayload(localEngine, apiPred, series);

  const outDir = path.join(__dirname, '..', 'test-results');
  fs.mkdirSync(outDir, { recursive: true });

  const dataDir = path.join(__dirname, '..', 'data');
  fs.mkdirSync(dataDir, { recursive: true });

  const fullPayload = {
    meta: { generated_at: new Date().toISOString(), version: '7.0' },
    system: { health_score: 85, status: { color: 'verde', label: 'Test', reasons: [] }, alerts: [], actions: [] },
    kpis: [],
    ...dashboard,
    funnel: { transitions: [], feeders: [], top_leaks: [] },
    operations: { total_leads: 0, hourly_distribution: [] },
    investment: { campaigns: [], total_spend: 0, campaign_count: 0 },
  };

  fs.writeFileSync(path.join(dataDir, 'dashboard_payload.json'), JSON.stringify(fullPayload, null, 2));
  fs.writeFileSync(
    path.join(outDir, 'predictionV2-comparative.json'),
    JSON.stringify({ apiPred, localEngine, dashboard, generated_at: new Date().toISOString() }, null, 2)
  );

  console.log('PASS — forecast_rf.available:', dashboard.forecast_rf.available);
  console.log('Saved data/dashboard_payload.json for UI smoke test');
}

main().catch((err) => {
  console.error('FAIL:', err.message);
  process.exit(1);
});
