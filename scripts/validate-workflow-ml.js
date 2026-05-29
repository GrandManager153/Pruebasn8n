/**
 * Validates Mkt_BI_IA_v7 (2).json ML integration contract.
 */
const fs = require('fs');
const path = require('path');

const wfPath = path.join(__dirname, '..', 'Mkt_BI_IA_v7 (2).json');
const wf = JSON.parse(fs.readFileSync(wfPath, 'utf8'));
const errors = [];

function req(cond, msg) {
  if (!cond) errors.push(msg);
}

const names = wf.nodes.map((n) => n.name);
req(names.includes('PrepareMLPayload'), 'Falta nodo PrepareMLPayload');
req(names.includes('HTTP_ML_Predict'), 'Falta nodo HTTP_ML_Predict');

const http = wf.nodes.find((n) => n.name === 'HTTP_ML_Predict');
req(http?.continueOnFail === true, 'HTTP_ML_Predict debe tener continueOnFail');
req((http?.parameters?.url || '').includes('$vars.ML_API_BASE_URL'), 'HTTP URL debe usar $vars.ML_API_BASE_URL');

const webhook = wf.nodes.find((n) => n.name === 'HTTP Request');
req((webhook?.parameters?.url || '').includes('$vars.WEBHOOK_BASE_URL'), 'HTTP Request debe usar $vars.WEBHOOK_BASE_URL');

const slConn = wf.connections.Src_Llegadas?.main?.[0] || [];
req(slConn.some((c) => c.node === 'PrepareMLPayload'), 'Src_Llegadas debe conectar a PrepareMLPayload');

const fb = wf.nodes.find((n) => n.name === 'FactsBuilder');
const fbCode = fb?.parameters?.jsCode || '';
req(fbCode.includes('_applyHybridPredictionV2'), 'FactsBuilder sin _applyHybridPredictionV2');
req(fbCode.includes('_apiPred'), 'FactsBuilder sin _apiPred');
req(fbCode.includes('local_engine'), 'FactsBuilder sin local_engine');
req(fbCode.includes('api_engine'), 'FactsBuilder sin api_engine');

const dpb = wf.nodes.find((n) => n.name === 'DashboardPayloadBuilder');
const dpbCode = dpb?.parameters?.jsCode || '';
req(dpbCode.includes('forecast_rf'), 'DashboardPayloadBuilder sin forecast_rf');
req(dpbCode.includes('local_engine'), 'DashboardPayloadBuilder debe usar local_engine para forecast');

const apiDir = path.join(__dirname, '..', 'ml-forecast-api');
['app.py', 'model.py', 'features.py', 'requirements.txt'].forEach((f) => {
  req(fs.existsSync(path.join(apiDir, f)), `Falta ml-forecast-api/${f}`);
});

if (errors.length) {
  console.error('VALIDATION FAILED:');
  errors.forEach((e) => console.error(' -', e));
  process.exit(1);
}
console.log('VALIDATION OK:', wfPath);
