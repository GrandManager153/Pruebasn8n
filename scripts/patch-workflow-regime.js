/**
 * Patches FactsBuilder: early changepoint + regime routing for local model selection.
 */
const fs = require('fs');
const path = require('path');

const EARLY_CP = `  // --- Early changepoint for regime routing ---
  let _forecastRegime = 'stable';
  let _regimeChangepoint = { detected: false };
  if (_n >= 14) {
    const _rcTarget = _volMean;
    let _rcPos = 0, _rcNeg = 0;
    const _rcK = 0.5 * _volStd;
    const _rcH = 4 * _volStd;
    let _rcIdx = -1, _rcDir = '';
    for (let ci = 0; ci < _n; ci++) {
      _rcPos = Math.max(0, _rcPos + _vols[ci] - _rcTarget - _rcK);
      _rcNeg = Math.max(0, _rcNeg - _vols[ci] + _rcTarget - _rcK);
      if (_rcPos > _rcH) { _rcIdx = ci; _rcDir = 'upward'; _rcPos = 0; }
      if (_rcNeg > _rcH) { _rcIdx = ci; _rcDir = 'downward'; _rcNeg = 0; }
    }
    if (_rcIdx >= _n - 10) {
      _regimeChangepoint = {
        detected: true,
        change_date: _dates[_rcIdx].toISOString().split('T')[0],
        direction: _rcDir
      };
      _forecastRegime = 'post_changepoint';
    }
  }

`;

const OLD_RANKED = `  const _ranked = [..._mRes].sort((a, b) => a.mase - b.mase);
  const _best = _ranked[0];`;

const NEW_RANKED = `${EARLY_CP}  let _ranked = [..._mRes].sort((a, b) => a.mase - b.mase);
  if (_forecastRegime === 'post_changepoint') {
    const _postCpModels = new Set(['ewma', 'mean_7d', 'seasonal_naive']);
    const _filtered = _ranked.filter(m => _postCpModels.has(m.name));
    if (_filtered.length > 0) _ranked = _filtered;
  }
  const _best = _ranked[0];`;

const OLD_CP_ASSIGN = '  predictionV2.changepoint = _cusumData;';
const NEW_CP_ASSIGN = `  predictionV2.changepoint = _cusumData;
  predictionV2.regime = _forecastRegime;`;

const OLD_FORECAST_CP =
  '      changepoint: linear.changepoint || pv2.changepoint || { detected: false },';
const NEW_FORECAST_CP =
  '      changepoint: linear.changepoint || pv2.changepoint || { detected: false },\n      regime: linear.regime || pv2.regime || \'stable\',';
const OLD_FORECAST_CP_V1 =
  '    changepoint: pv2.changepoint || { detected: false },';
const NEW_FORECAST_CP_V1 =
  '    changepoint: pv2.changepoint || { detected: false },\n    regime: pv2.regime || \'stable\',';

function patchWorkflow(filePath) {
  const wf = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const fb = wf.nodes.find((n) => n.name === 'FactsBuilder');
  if (!fb) {
    console.warn(`FactsBuilder not found in ${filePath}`);
    return false;
  }

  let code = fb.parameters.jsCode;
  if (code.includes('_forecastRegime')) {
    console.log(`Regime already patched: ${path.basename(filePath)}`);
  } else if (code.includes(OLD_RANKED)) {
    code = code.replace(OLD_RANKED, NEW_RANKED);
    console.log(`Patched regime routing in FactsBuilder (${path.basename(filePath)})`);
  } else {
    console.error(`_ranked block not found in ${filePath}`);
    return false;
  }

  if (!code.includes('predictionV2.regime')) {
    if (code.includes(OLD_CP_ASSIGN)) {
      code = code.replace(OLD_CP_ASSIGN, NEW_CP_ASSIGN);
    } else {
      console.warn(`changepoint assign not found in ${filePath}`);
    }
  }

  fb.parameters.jsCode = code;

  const dpb = wf.nodes.find((n) => n.name === 'DashboardPayloadBuilder');
  if (dpb && !dpb.parameters.jsCode.includes('regime:')) {
    if (dpb.parameters.jsCode.includes(OLD_FORECAST_CP)) {
      dpb.parameters.jsCode = dpb.parameters.jsCode.replace(OLD_FORECAST_CP, NEW_FORECAST_CP);
      console.log(`Patched regime in DashboardPayloadBuilder (${path.basename(filePath)})`);
    } else if (dpb.parameters.jsCode.includes(OLD_FORECAST_CP_V1)) {
      dpb.parameters.jsCode = dpb.parameters.jsCode.replace(OLD_FORECAST_CP_V1, NEW_FORECAST_CP_V1);
      console.log(`Patched regime (v1 block) in DashboardPayloadBuilder (${path.basename(filePath)})`);
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(wf, null, 2), 'utf8');
  return true;
}

const root = path.join(__dirname, '..');
['Mkt_BI_IA_v7 (2).json'].forEach((name) => {
  const fp = path.join(root, name);
  if (fs.existsSync(fp)) patchWorkflow(fp);
});
