/**
 * Patches Mkt_BI_IA_v7 (2).json: ML nodes + FactsBuilder hybrid + dual forecast payload.
 */
const fs = require('fs');
const path = require('path');

const wfPath = path.join(__dirname, '..', 'Mkt_BI_IA_v7 (2).json');
const wf = JSON.parse(fs.readFileSync(wfPath, 'utf8'));

const prepareMLCode = `// === PREPARE ML PAYLOAD ===
const rows = items.map(i => i.json).filter(r => r.contactos !== undefined && r.fecha);
let series;
if (rows.length === 0) {
  const today = new Date();
  series = [];
  for (let i = 41; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i - 1);
    series.push({
      date: d.toISOString().split('T')[0],
      value: 80 + Math.round(Math.sin(i / 5) * 15) + Math.floor(i / 3)
    });
  }
} else {
  series = rows
    .map(r => ({
      date: typeof r.fecha === 'string' ? r.fecha.split('T')[0] : new Date(r.fecha).toISOString().split('T')[0],
      value: parseInt(r.contactos) || 0
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
return [{ json: { series, backtest_days: 14, model: 'random_forest' } }];`;

const newNodes = [
  {
    parameters: { jsCode: prepareMLCode },
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [1100, 1500],
    id: 'a0000001-0000-0000-0000-000000000020',
    name: 'PrepareMLPayload',
  },
  {
    parameters: {
      method: 'POST',
      url: "={{ ($vars.ML_API_BASE_URL || 'http://127.0.0.1:8000') + '/predict' }}",
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: '={{ JSON.stringify($json) }}',
      options: { timeout: 120000 },
    },
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [1400, 1500],
    id: 'a0000001-0000-0000-0000-000000000021',
    name: 'HTTP_ML_Predict',
    continueOnFail: true,
    credentials: {
      httpHeaderAuth: {
        id: 'ML_API_CREDENTIAL_ID',
        name: 'ML Forecast API',
      },
    },
  },
];

const names = new Set(newNodes.map((n) => n.name));
wf.nodes = wf.nodes.filter((n) => !names.has(n.name));
wf.nodes.push(...newNodes);

wf.connections.Src_Llegadas = {
  main: [
    [
      { node: 'Merge_Arrivals_Hours', type: 'main', index: 0 },
      { node: 'PrepareMLPayload', type: 'main', index: 0 },
    ],
  ],
};
wf.connections.PrepareMLPayload = {
  main: [[{ node: 'HTTP_ML_Predict', type: 'main', index: 0 }]],
};

const fb = wf.nodes.find((n) => n.name === 'FactsBuilder');
if (!fb) throw new Error('FactsBuilder not found');

let code = fb.parameters.jsCode;

const apiPredInit = `// --- API prediction (HTTP_ML_Predict) ---
let _apiPred = null;
try {
  const _r = $('HTTP_ML_Predict').first().json;
  if (_r && _r.recommended_value != null && !_r.error && !_r.detail) _apiPred = _r;
} catch (e) {}

function _applyHybridPredictionV2(pv2, apiPred) {
  const localSnap = JSON.parse(JSON.stringify(pv2));
  pv2.local_engine = localSnap;
  if (!apiPred) {
    pv2.source = 'local';
    return pv2;
  }
  pv2.api_engine = apiPred;
  const localMase = (localSnap.diagnostics && localSnap.diagnostics.best_mase != null)
    ? localSnap.diagnostics.best_mase
    : (localSnap.backtest && localSnap.backtest.models && localSnap.backtest.models[0] && localSnap.backtest.models[0].mase != null)
      ? localSnap.backtest.models[0].mase
      : 999;
  const apiMase = apiPred.mase != null ? apiPred.mase : 999;
  if (apiMase <= localMase) {
    pv2.source = 'api';
    pv2.recommended_value = apiPred.recommended_value;
    pv2.model_name = apiPred.model_name || 'random_forest';
    pv2.mode = apiPred.mode || pv2.mode;
    pv2.confidence = apiPred.confidence || pv2.confidence;
    pv2.label = apiPred.label || pv2.label;
    if (apiPred.backtest) pv2.backtest = apiPred.backtest;
    if (apiPred.forecast_horizons) pv2.forecast_horizons = apiPred.forecast_horizons;
    if (apiPred.intervals) pv2.intervals = apiPred.intervals;
    if (apiPred.observed_forecast) pv2.observed_forecast = apiPred.observed_forecast;
    pv2.diagnostics = Object.assign({}, pv2.diagnostics || {}, { api_mase: apiMase, local_mase: localMase });
  } else {
    pv2.source = 'local';
    pv2.diagnostics = Object.assign({}, pv2.diagnostics || {}, { api_mase: apiMase, local_mase: localMase, winner: 'local' });
  }
  return pv2;
}

`;

const engineMarker = '// --- PREDICTION ENGINE V3 ---';
if (!code.includes(engineMarker)) throw new Error('PREDICTION ENGINE V3 marker not found');
if (!code.includes('_applyHybridPredictionV2')) {
  code = code.replace(engineMarker, apiPredInit + engineMarker);
}

const hook1 = 'predictionV2.quality_note = _pqNote;';
const hook1Replacement = `predictionV2.quality_note = _pqNote;
  _applyHybridPredictionV2(predictionV2, _apiPred);`;

if (code.includes(hook1) && !code.includes('_applyHybridPredictionV2(predictionV2, _apiPred)')) {
  code = code.replace(hook1, hook1Replacement);
}

const hook2 =
  "predictionV2.diagnostics = { total_history_days: _vols.length, backtest_days: 0, best_model: 'mean_7d', best_mase: null, ensemble_used: false, fallback_reason: 'insufficient_history' };";
const hook2Replacement = hook2 + '\n  _applyHybridPredictionV2(predictionV2, _apiPred);';

if (
  code.includes(hook2) &&
  !code.includes("fallback_reason: 'insufficient_history' };\n  _applyHybridPredictionV2")
) {
  code = code.replace(hook2, hook2Replacement);
}

fb.parameters.jsCode = code;

const dpb = wf.nodes.find((n) => n.name === 'DashboardPayloadBuilder');
if (!dpb) throw new Error('DashboardPayloadBuilder not found');

const oldForecastBlock = `  forecast: {
    recommended_value: pv2.recommended_value || null,
    method: pv2.model_name || null,
    mase: pv2.diagnostics ? pv2.diagnostics.best_mase : null,
    confidence: pv2.confidence || null,
    quality_label: pv2.quality_label || null,
    r2: facts.projections ? facts.projections.r2 : null,
    slope: facts.projections ? facts.projections.slope : null,
    intervals: pv2.intervals || {},
    horizons: pv2.forecast_horizons || {},
    backtest_models: pv2.backtest ? pv2.backtest.models : [],
    seasonal_indices: pv2.seasonal_indices || [],
    changepoint: pv2.changepoint || { detected: false },
    time_series: facts.raw_time_series || []
  },`;

const newForecastBlock = `  forecast: (function() {
    var linear = pv2.local_engine || pv2;
    return {
      recommended_value: linear.recommended_value || null,
      method: linear.model_name || null,
      mase: linear.diagnostics ? linear.diagnostics.best_mase : (linear.mase != null ? linear.mase : null),
      confidence: linear.confidence || null,
      quality_label: linear.quality_label || linear.label || null,
      r2: facts.projections ? facts.projections.r2 : null,
      slope: facts.projections ? facts.projections.slope : null,
      intervals: linear.intervals || {},
      horizons: linear.forecast_horizons || {},
      backtest_models: linear.backtest ? linear.backtest.models : [],
      seasonal_indices: linear.seasonal_indices || pv2.seasonal_indices || [],
      changepoint: linear.changepoint || pv2.changepoint || { detected: false },
      time_series: facts.raw_time_series || []
    };
  })(),
  forecast_rf: (function() {
    var api = pv2.api_engine;
    var ts = facts.raw_time_series || [];
    if (!api || api.recommended_value == null || api.error) {
      return { available: false, reason: 'ML API no disponible en esta ejecucion', time_series: ts };
    }
    return {
      available: true,
      model_name: api.model_name || 'random_forest',
      recommended_value: api.recommended_value,
      mase: api.mase,
      confidence: api.confidence || null,
      mode: api.mode || null,
      label: api.label || null,
      method: api.model_name || 'random_forest',
      intervals: api.intervals || {},
      horizons: api.forecast_horizons || {},
      backtest_models: api.backtest ? api.backtest.models : [],
      seasonal_indices: [],
      changepoint: { detected: false },
      time_series: ts
    };
  })(),`;

let dpbCode = dpb.parameters.jsCode;
if (dpbCode.includes('forecast_rf:')) {
  console.log('DashboardPayloadBuilder already has forecast_rf');
} else if (dpbCode.includes(oldForecastBlock)) {
  dpbCode = dpbCode.replace(oldForecastBlock, newForecastBlock);
  dpb.parameters.jsCode = dpbCode;
  console.log('Patched DashboardPayloadBuilder with forecast + forecast_rf');
} else {
  throw new Error('DashboardPayloadBuilder forecast block not found — manual patch required');
}

fs.writeFileSync(wfPath, JSON.stringify(wf, null, 2), 'utf8');
console.log('Patched', wfPath);
console.log('Nodes:', newNodes.map((n) => n.name).join(', '));
