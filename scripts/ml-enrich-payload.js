/**
 * Enriquece dashboard_payload con predicciones del ML API local.
 * Útil cuando n8n Cloud no puede alcanzar localhost:8000 (solo ngrok en :3000).
 */
const http = require('http');
const { enrichLinearForecastModels } = require('./linear-backtest');
const { computeTrainTestSplit, testZoneCoverage } = require('./train-test-split');

const ML_API_BASE = process.env.ML_API_BASE_URL || 'http://127.0.0.1:8000';
const ML_API_KEY = process.env.ML_API_KEY || process.env.API_KEY || 'mkt-bi-ia-dev-key';

function resolveBacktestDays(seriesLength) {
  return Math.max(14, seriesLength - 15);
}

function postPredict(series, model = 'compare') {
  return new Promise((resolve, reject) => {
    const url = new URL(`${ML_API_BASE.replace(/\/$/, '')}/predict`);
    const body = JSON.stringify({
      series,
      backtest_days: resolveBacktestDays(series.length),
      model,
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

const SKLEARN_MODEL_NAMES = [
  'random_forest',
  'gradient_boosting',
  'ridge',
  'mlp_neural_network',
  'lightgbm',
];

function modelNeedsForecast1d(entry) {
  if (!entry || !entry.name) return false;
  if (String(entry.name).toLowerCase() === 'seasonal_naive') return false;
  return entry.forecast_1d == null || !Number.isFinite(Number(entry.forecast_1d));
}

function needsMlModelForecastEnrichment(payload) {
  const rf = payload && payload.forecast_rf;
  if (!rf || rf.available === false || !Array.isArray(rf.backtest_models)) return false;
  return rf.backtest_models.some(modelNeedsForecast1d);
}

async function enrichMlModelForecasts(payload) {
  const rf = payload && payload.forecast_rf;
  if (!rf || rf.available === false) return payload;
  const baseTs = resolveTimeSeries(payload);
  if (!baseTs.length) return payload;
  const series = baseTs.map((d) => ({ date: d.date, value: d.value }));

  const mergeModelForecasts = (models) => {
    (models || []).forEach((src) => {
      const entry = (rf.backtest_models || []).find(
        (m) => String(m.name).toLowerCase() === String(src.name).toLowerCase()
      );
      if (!entry) return;
      if (src.forecast_1d != null && Number.isFinite(Number(src.forecast_1d))) {
        entry.forecast_1d = src.forecast_1d;
      }
      if (src.horizons) entry.horizons = src.horizons;
    });
  };

  const syncPrimaryForecast = () => {
    const primaryName = String(rf.model_name || 'random_forest').toLowerCase();
    const primary = (rf.backtest_models || []).find(
      (m) => String(m.name).toLowerCase() === primaryName
    );
    if (!primary) return;
    if (modelNeedsForecast1d(primary)) {
      const v = rf.recommended_value ?? rf.horizons?.next_1d?.forecast;
      if (v != null && Number.isFinite(Number(v))) {
        primary.forecast_1d = Math.round(Number(v));
        primary.horizons = primary.horizons || rf.horizons || null;
      }
    }
  };

  try {
    const pred = await postPredict(series, 'compare');
    mergeModelForecasts(pred.backtest && pred.backtest.models);
    syncPrimaryForecast();

    for (const entry of rf.backtest_models || []) {
      if (!modelNeedsForecast1d(entry)) continue;
      try {
        const single = await postPredict(series, entry.name);
        if (single.recommended_value != null) entry.forecast_1d = single.recommended_value;
        if (single.forecast_horizons) entry.horizons = single.forecast_horizons;
      } catch (err) {
        console.log(`  ⚠️ ML forecast_1d para ${entry.name} falló: ${err.message}`);
      }
    }
  } catch (err) {
    console.log(`  ⚠️ ML compare forecast_1d falló: ${err.message}`);
    syncPrimaryForecast();
  }
  return payload;
}

function modelSeriesCoverage(series) {
  if (!Array.isArray(series)) return 0;
  return series.filter((v) => v != null && isFinite(v)).length;
}

function needsMlEnrichment(payload) {
  const rf = payload && payload.forecast_rf;
  const baseTs = resolveTimeSeries(payload);
  const tsLen = baseTs.length;
  if (!tsLen) return false;

  const split = payload?.forecast?.train_test_split
    || rf?.diagnostics?.train_test_split
    || computeTrainTestSplit(tsLen, baseTs);
  if (!split) return true;

  if (!rf) return true;
  if (rf.available === false) return true;
  if (rf.mase == null || !Array.isArray(rf.backtest_series) || !rf.backtest_series.length) return true;

  const expectedTest = Math.max(1, split.test_count - 1);
  const mlModels = (rf.backtest_models || []).filter(
    (m) => SKLEARN_MODEL_NAMES.includes(String(m.name).toLowerCase())
  );

  if (mlModels.length) {
    const minTestCov = Math.min(...mlModels.map((m) => testZoneCoverage(m.series, split.split_index)));
    if (minTestCov < expectedTest) return true;
    const minTrainCov = Math.min(
      ...mlModels.map((m) => {
        if (!Array.isArray(m.series)) return 0;
        return m.series.slice(0, split.split_index).filter((v) => v != null && isFinite(v)).length;
      })
    );
    if (minTrainCov < Math.max(1, split.split_index - 2)) return true;
  }

  if (!payload.forecast?.train_test_split) return true;

  return false;
}

function expectedModelPoints(_modelName, seriesLength, splitIndex) {
  if (splitIndex == null) return seriesLength;
  return Math.max(0, seriesLength - splitIndex);
}

function ensureTrainTestSplit(payload) {
  if (!payload?.forecast) return payload;
  const ts = resolveTimeSeries(payload);
  if (!ts.length) return payload;
  if (!payload.forecast.train_test_split) {
    const split = computeTrainTestSplit(ts.length, ts);
    if (split) payload.forecast.train_test_split = split;
  }
  if (payload.forecast_rf) {
    payload.forecast_rf.diagnostics = payload.forecast_rf.diagnostics || {};
    if (!payload.forecast_rf.diagnostics.train_test_split && payload.forecast.train_test_split) {
      payload.forecast_rf.diagnostics.train_test_split = payload.forecast.train_test_split;
    }
  }
  return payload;
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
    const primaryModel = payload.forecast_rf.backtest_models.find(
      (m) => String(m.name).toLowerCase() === String(payload.forecast_rf.model_name || 'random_forest').toLowerCase()
    );
    payload.forecast_rf.series = (primaryModel && Array.isArray(primaryModel.series) && primaryModel.series.length)
      ? primaryModel.series
      : buildRfAlignedSeries(baseTs, pred.backtest_series || []);
    payload.forecast_rf.next_point = pred.next_point || null;
    if (payload.forecast) {
      payload.forecast.next_point = pred.next_point || payload.forecast.next_point || null;
      if (pred.train_test_split) {
        payload.forecast.train_test_split = pred.train_test_split;
      } else if (pred.backtest?.train_test_split) {
        payload.forecast.train_test_split = pred.backtest.train_test_split;
      } else if (pred.diagnostics?.train_test_split) {
        payload.forecast.train_test_split = pred.diagnostics.train_test_split;
      }
    }
    payload.forecast_rf.diagnostics = {
      ...(payload.forecast_rf.diagnostics || {}),
      ...(pred.diagnostics || {}),
      train_test_split: payload.forecast?.train_test_split || pred.train_test_split || pred.diagnostics?.train_test_split,
    };
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
  payload = enrichLinearForecastModels(payload, { force: true });
  payload = await enrichPayloadWithMlApi(payload);
  if (needsMlModelForecastEnrichment(payload)) {
    payload = await enrichMlModelForecasts(payload);
  }
  payload = attachForecastFieldsToPayload(payload);
  payload = ensureTrainTestSplit(payload);
  return syncRfAlignedSeries(payload);
}

function attachForecastFieldsToPayload(payload) {
  if (!payload) return payload;
  const rf = payload.forecast_rf;
  if (!rf || !Array.isArray(rf.backtest_models)) return payload;
  (payload.forecast?.backtest_models || []).forEach((stat) => {
    const entry = rf.backtest_models.find(
      (m) => String(m.name).toLowerCase() === String(stat.name).toLowerCase()
    );
    if (!entry) return;
    if ((entry.forecast_1d == null || !Number.isFinite(Number(entry.forecast_1d))) && stat.forecast_1d != null) {
      entry.forecast_1d = stat.forecast_1d;
    }
    if (!entry.horizons && stat.horizons) entry.horizons = stat.horizons;
  });
  return payload;
}

module.exports = {
  enrichPayloadWithMlApi,
  enrichPayloadComplete,
  needsMlEnrichment,
  needsMlModelForecastEnrichment,
  enrichMlModelForecasts,
  attachForecastFieldsToPayload,
  ensureTrainTestSplit,
  resolveBacktestDays,
  buildRfAlignedSeries,
  rfAlignedCoverage,
  computeTrainTestSplit,
};
