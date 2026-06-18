/**
 * Adds forecast_1d and horizons to each backtest_models entry in dashboard_payload.sample.json
 * using the same scaling logic as FactsBuilder (approximation from series last value).
 */
const fs = require('fs');
const path = require('path');

const samplePath = path.join(__dirname, '..', 'data', 'dashboard_payload.sample.json');
const payload = JSON.parse(fs.readFileSync(samplePath, 'utf8'));

function normName(n) {
  return String(n || '').trim().toLowerCase();
}
const f = payload.forecast;
if (!f || !Array.isArray(f.backtest_models)) {
  console.error('Invalid sample payload');
  process.exit(1);
}

const seasonal = Array.isArray(f.seasonal_indices)
  ? f.seasonal_indices.map((d) => d.index)
  : [1, 1, 1, 1, 1, 1, 1];
const todayDow = new Date().getDay();

function buildHorizons(modelName, fc1d, mase) {
  if (fc1d == null || !isFinite(fc1d)) return null;
  const q80 = Math.max(8, Math.round(fc1d * (0.08 + (mase || 1) * 0.05)));
  const h = {
    next_1d: {
      forecast: fc1d,
      band_low: Math.max(0, fc1d - q80),
      band_high: fc1d + q80,
      method: modelName,
    },
  };
  let s7 = 0;
  for (let d = 0; d < 7; d++) s7 += fc1d * (seasonal[(todayDow + d + 1) % 7] || 1);
  s7 = Math.round(s7);
  const u7 = q80 * Math.sqrt(7);
  h.next_7d = {
    forecast: s7,
    band_low: Math.max(0, Math.round(s7 - u7)),
    band_high: Math.round(s7 + u7),
    method: modelName + '+seasonal',
  };
  let s14 = 0;
  for (let d = 0; d < 14; d++) s14 += fc1d * (seasonal[(todayDow + d + 1) % 7] || 1);
  s14 = Math.round(s14);
  const u14 = q80 * Math.sqrt(14);
  h.next_14d = {
    forecast: s14,
    band_low: Math.max(0, Math.round(s14 - u14)),
    band_high: Math.round(s14 + u14),
    method: modelName + '+seasonal',
  };
  return h;
}

f.backtest_models.forEach((m) => {
  let fc1d = m.forecast_1d;
  if (fc1d == null && Array.isArray(m.series) && m.series.length) {
    fc1d = m.series[m.series.length - 1];
  }
  if (normName(m.name) === normName(f.method) && f.horizons?.next_1d) {
    m.horizons = f.horizons;
    m.forecast_1d = f.horizons.next_1d.forecast;
    return;
  }
  m.forecast_1d = fc1d != null ? Math.round(fc1d) : null;
  m.horizons = buildHorizons(m.name, m.forecast_1d, m.mase);
});

const rf = payload.forecast_rf;
if (rf && rf.available !== false) {
  const rfName = rf.model_name || 'random_forest';
  const fc1d = rf.recommended_value ?? rf.horizons?.next_1d?.forecast;
  if (rf.horizons) {
    const entry = rf.backtest_models?.find((x) => x.name === rfName);
    if (entry) {
      entry.horizons = rf.horizons;
      entry.forecast_1d = fc1d;
    }
  }
}

fs.writeFileSync(samplePath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
console.log('Enriched', f.backtest_models.length, 'models with horizons in sample payload');
