/**
 * Patches FactsBuilder in n8n workflow JSON files to export per-model
 * backtest series, forecast_1d, and horizons (next_1d/7d/14d).
 */
const fs = require('fs');
const path = require('path');

const OLD_BLOCK = `predictionV2.backtest = {
    window_days: _btWin, naive_mae: Math.round(_naiveMAE * 100) / 100,
    models: _ranked.map(m => ({ name: m.name, mae: Math.round(m.mae * 100) / 100, mase: Math.round(m.mase * 1000) / 1000, rmse: Math.round(m.rmse * 100) / 100 })),
    selected: _selMethod, ensemble_weights: _useEns ? _ensW : null
  };`;

const NEW_BLOCK = `function _buildModelHorizons(modelName, fc1d, mr) {
    if (fc1d == null || isNaN(fc1d)) return null;
    const sortedAbs = mr && mr.abs && mr.abs.length ? [...mr.abs].sort((a, b) => a - b) : [];
    const q80m = _quantile(sortedAbs, 0.80);
    const h = {};
    h.next_1d = {
      forecast: fc1d,
      band_low: Math.round(Math.max(0, fc1d - q80m)),
      band_high: Math.round(fc1d + q80m),
      method: modelName
    };
    let s7 = 0;
    for (let d = 0; d < 7; d++) s7 += fc1d * _sIdx[(_todayDow + d + 1) % 7];
    s7 = Math.round(s7);
    const u7 = q80m * Math.sqrt(7);
    h.next_7d = {
      forecast: s7,
      band_low: Math.round(Math.max(0, s7 - u7)),
      band_high: Math.round(s7 + u7),
      method: modelName + '+seasonal'
    };
    let s14 = 0;
    for (let d = 0; d < 14; d++) s14 += fc1d * _sIdx[(_todayDow + d + 1) % 7];
    s14 = Math.round(s14);
    const u14 = q80m * Math.sqrt(14);
    h.next_14d = {
      forecast: s14,
      band_low: Math.round(Math.max(0, s14 - u14)),
      band_high: Math.round(s14 + u14),
      method: modelName + '+seasonal'
    };
    return h;
  }

  predictionV2.backtest = {
    window_days: _btWin, naive_mae: Math.round(_naiveMAE * 100) / 100,
    models: _ranked.map(m => {
      const mr = _mRes.find(x => x.name === m.name);
      const fc1d = _fcasts[m.name];
      const horizons = _buildModelHorizons(m.name, fc1d, mr);
      return {
        name: m.name,
        mae: Math.round(m.mae * 100) / 100,
        mase: Math.round(m.mase * 1000) / 1000,
        rmse: Math.round(m.rmse * 100) / 100,
        series: mr && mr.preds ? mr.preds : [],
        forecast_1d: fc1d != null ? fc1d : null,
        horizons: horizons
      };
    }),
    selected: _selMethod, ensemble_weights: _useEns ? _ensW : null
  };`;

function patchWorkflow(filePath) {
  const wf = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const fb = wf.nodes.find((n) => n.name === 'FactsBuilder');
  if (!fb) {
    console.warn(`FactsBuilder not found in ${filePath}`);
    return false;
  }
  let code = fb.parameters.jsCode;
  if (code.includes('_buildModelHorizons')) {
    console.log(`Already patched: ${path.basename(filePath)}`);
    return true;
  }
  if (!code.includes(OLD_BLOCK)) {
    console.error(`Old backtest block not found in ${filePath}`);
    return false;
  }
  code = code.replace(OLD_BLOCK, NEW_BLOCK);
  fb.parameters.jsCode = code;
  fs.writeFileSync(filePath, JSON.stringify(wf, null, 2), 'utf8');
  console.log(`Patched FactsBuilder in ${path.basename(filePath)}`);
  return true;
}

const root = path.join(__dirname, '..');
['Mkt_BI_IA_v7 (2).json'].forEach((name) => {
  const fp = path.join(root, name);
  if (fs.existsSync(fp)) patchWorkflow(fp);
});
