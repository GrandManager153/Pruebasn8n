/**
 * Enriquece dashboard_payload con predicciones del ML API local.
 * Útil cuando n8n Cloud no puede alcanzar localhost:8000 (solo ngrok en :3000).
 */
const http = require('http');
const { enrichLinearForecastModels } = require('./linear-backtest');

const ML_API_BASE = process.env.ML_API_BASE_URL || 'http://127.0.0.1:8000';
const ML_API_KEY = process.env.ML_API_KEY || process.env.API_KEY || 'mkt-bi-ia-dev-key';

function resolveBacktestDays(seriesLength) {
  return Math.max(14, seriesLength - 15);
}

function postPredict(series) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${ML_API_BASE.replace(/\/$/, '')}/predict`);
    const body = JSON.stringify({
      series,
      backtest_days: resolveBacktestDays(series.length),
      model: 'random_forest',
    });
    const req = http.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          'X-API-Key': ML_API_KEY,
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
    req.on('timeout', () => req.destroy(new Error('ML API timeout')));
    req.write(body);
    req.end();
  });
}

function needsMlEnrichment(payload) {
  const rf = payload && payload.forecast_rf;
  if (!rf) return true;
  if (rf.available === false) return true;
  if (rf.mase == null || !Array.isArray(rf.backtest_series) || !rf.backtest_series.length) return true;
  const tsLen = resolveTimeSeries(payload).length;
  const rfName = rf.model_name || 'random_forest';
  const rfEntry = (payload.forecast?.backtest_models || []).find(
    (m) => String(m.name).toLowerCase() === String(rfName).toLowerCase()
  );
  const target = rfEntry ? expectedModelPoints(rfEntry.name, tsLen) : tsLen;
  return rfAlignedCoverage(payload) < target;
}

function expectedModelPoints(_modelName, seriesLength) {
  return seriesLength;
}

function resolveTimeSeries(payload) {
  const rf = payload.forecast_rf;
  if (rf && Array.isArray(rf.time_series) && rf.time_series.length) return rf.time_series;
  const f = payload.forecast;
  if (f && Array.isArray(f.time_series) && f.time_series.length) return f.time_series;
  return [];
}

function buildRfAlignedSeries(baseTs, backtestSeries) {
  if (!Array.isArray(baseTs) || !baseTs.length || !Array.isArray(backtestSeries) || !backtestSeries.length) {
    return null;
  }
  const predByDate = {};
  backtestSeries.forEach((p) => {
    if (p && p.date != null && p.predicted != null) {
      predByDate[String(p.date).split('T')[0]] = Math.round(Number(p.predicted));
    }
  });
  const aligned = baseTs.map((d) => {
    const key = String(d.date).split('T')[0];
    return key in predByDate ? predByDate[key] : null;
  });
  return aligned.some((v) => v != null) ? aligned : null;
}

function rfAlignedCoverage(payload) {
  const baseTs = resolveTimeSeries(payload);
  const rf = payload && payload.forecast_rf;
  if (!baseTs.length || !rf) return 0;
  if (Array.isArray(rf.series) && rf.series.length === baseTs.length) {
    return rf.series.filter((v) => v != null && isFinite(v)).length;
  }
  const aligned = buildRfAlignedSeries(baseTs, rf.backtest_series || []);
  return aligned ? aligned.filter((v) => v != null && isFinite(v)).length : 0;
}

function syncRfAlignedSeries(payload) {
  if (!payload?.forecast_rf) return payload;
  const baseTs = resolveTimeSeries(payload);
  if (!baseTs.length) return payload;
  const rf = payload.forecast_rf;
  const aligned = buildRfAlignedSeries(baseTs, rf.backtest_series || []);
  if (aligned) rf.series = aligned;
  rf.time_series = rf.time_series?.length ? rf.time_series : baseTs;
  return payload;
}

async function enrichPayloadWithMlApi(payload) {
  if (!payload) return payload;

  const baseTs = resolveTimeSeries(payload);
  if (!needsMlEnrichment(payload)) return syncRfAlignedSeries(payload);
  if (!baseTs.length) {
    console.log('  ⚠️ ML enrich: sin time_series en payload, se omite');
    return payload;
  }

  const series = baseTs.map((d) => ({ date: d.date, value: d.value }));
  try {
    const pred = await postPredict(series);
    payload.forecast_rf = payload.forecast_rf || {};
    payload.forecast_rf.available = true;
    payload.forecast_rf.model_name = pred.model_name || 'random_forest';
    payload.forecast_rf.recommended_value = pred.recommended_value;
    payload.forecast_rf.mase = pred.mase;
    payload.forecast_rf.horizons = pred.forecast_horizons || payload.forecast_rf.horizons || {};
    payload.forecast_rf.backtest_models = (pred.backtest && pred.backtest.models) || payload.forecast_rf.backtest_models || [];
    payload.forecast_rf.backtest_series = pred.backtest_series || [];
    payload.forecast_rf.series = buildRfAlignedSeries(baseTs, pred.backtest_series || []);
    payload.forecast_rf.next_point = pred.next_point || null;
    payload.forecast_rf.time_series = baseTs;
    delete payload.forecast_rf.reason;
    console.log(`  🤖 ML enrich OK — MASE ${pred.mase}, modelo ${payload.forecast_rf.model_name}`);
  } catch (err) {
    console.log(`  ⚠️ ML enrich falló (${err.message}); se guarda payload sin Random Forest`);
  }

  return payload;
}

async function enrichPayloadComplete(payload) {
  if (!payload) return payload;
  payload = enrichLinearForecastModels(payload);
  payload = await enrichPayloadWithMlApi(payload);
  return syncRfAlignedSeries(payload);
}

module.exports = {
  enrichPayloadWithMlApi,
  enrichPayloadComplete,
  needsMlEnrichment,
  resolveBacktestDays,
  buildRfAlignedSeries,
  rfAlignedCoverage,
};
