/** Recomputes linear model backtest series for dashboard charts. */
const { computeTrainTestSplit, testZoneCoverage } = require('./train-test-split');
const { attachForecastTarget } = require('./forecast-target');

function _matInv(m) {
  const n = m.length;
  const a = m.map((r, i) => [...r, ...Array(n).fill(0).map((_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let mx = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[mx][c])) mx = r;
    [a[c], a[mx]] = [a[mx], a[c]];
    if (Math.abs(a[c][c]) < 1e-10) return null;
    const pv = a[c][c];
    for (let j = 0; j < 2 * n; j++) a[c][j] /= pv;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = a[r][c];
      for (let j = 0; j < 2 * n; j++) a[r][j] -= f * a[c][j];
    }
  }
  return a.map((row) => row.slice(n));
}
function _matVecMul(A, v) {
  return A.map((row) => row.reduce((s, a, k) => s + a * v[k], 0));
}

function computeLinearBacktestModels(timeSeries, btWinMax = 28) {
  if (!Array.isArray(timeSeries) || timeSeries.length < 14) return null;
  const src = { llegadas: timeSeries.map((d) => ({ fecha: d.date, contactos: d.value })) };
  const predictionV2 = {};
  const btWinMaxRef = btWinMax;
  const _sorted = [...src.llegadas].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  const _dates = _sorted.map(r => new Date(r.fecha));
  const _vols = _sorted.map(r => parseInt(r.contactos) || 0);
  const _n = _vols.length;

  const _volMean = _vols.reduce((a, b) => a + b, 0) / _n;
  const _volVar = _vols.reduce((s, v) => s + Math.pow(v - _volMean, 2), 0) / _n;
  const _volStd = Math.sqrt(_volVar);
  const _volCV = _volMean > 0 ? _volStd / _volMean : 0;

  predictionV2.volatility = {
    mean: Math.round(_volMean * 100) / 100,
    stddev: Math.round(_volStd * 100) / 100,
    cv_pct: Math.round(_volCV * 10000) / 100,
    label: _volCV < 0.15 ? 'muy_estable' : _volCV < 0.3 ? 'estable' : _volCV < 0.5 ? 'moderada' : 'alta'
  };

  // Day-of-week seasonal indices
  const _dowS = [0,0,0,0,0,0,0], _dowC = [0,0,0,0,0,0,0];
  for (let i = 0; i < _n; i++) { const d = _dates[i].getDay(); _dowS[d] += _vols[i]; _dowC[d]++; }
  const _dowA = _dowS.map((s, i) => _dowC[i] > 0 ? s / _dowC[i] : _volMean);
  const _dowGM = _dowA.reduce((a, b) => a + b, 0) / 7;
  const _sIdx = _dowA.map(a => _dowGM > 0 ? a / _dowGM : 1);

  // ---- Model definitions (all pure JS, no imports) ----
  function _earlyPred(h, idx, ds, si) {
    if (idx <= 0) return h[0];
    const mean = h.slice(0, idx).reduce((a, b) => a + b, 0) / idx;
    if (ds && si && idx < ds.length) {
      const d = ds[idx].getDay();
      return mean * (si[d] > 0 ? si[d] : 1);
    }
    return mean;
  }
  function _mMean7(h, idx) {
    if (idx < 1) return h[0];
    if (idx < 7) return h.slice(0, idx).reduce((a, b) => a + b, 0) / idx;
    return h.slice(idx - 7, idx).reduce((a, b) => a + b, 0) / 7;
  }
  function _mSNaive(h, idx) {
    if (idx < 1) return h[0];
    if (idx < 7) return h[idx - 1];
    return h[idx - 7];
  }
  function _mEWMA(h, idx) {
    if (idx < 1) return h[0];
    let e = h[0]; const alpha = 0.3;
    for (let i = 1; i < idx; i++) e = alpha * h[i] + (1 - alpha) * e;
    return e;
  }
  function _mTheta(h, idx, ds, si) {
    if (idx < 14) return _earlyPred(h, idx, ds, si);
    const w = h.slice(0, idx);
    const dw = w.map((v, i) => { const d = ds[i].getDay(); return si[d] > 0 ? v / si[d] : v; });
    const wn = dw.length;
    let sx = 0, sy = 0, sxy = 0, sx2 = 0;
    for (let i = 0; i < wn; i++) { sx += i; sy += dw[i]; sxy += i * dw[i]; sx2 += i * i; }
    const sl = (wn * sxy - sx * sy) / (wn * sx2 - sx * sx || 1);
    const ic = (sy - sl * sx) / wn;
    const tz = ic + sl * wn;
    let ses = dw[0]; const sa = 0.2;
    for (let i = 1; i < wn; i++) ses = sa * dw[i] + (1 - sa) * ses;
    const combined = (tz + ses) / 2;
    const _tgtDate = idx < ds.length ? ds[idx] : new Date(ds[ds.length - 1].getTime() + 86400000);
    return combined * si[_tgtDate.getDay()];
  }
  function _mTSBlend(h, idx, ds, si) {
    if (idx < 1) return h[0];
    const r3 = idx >= 3
      ? h.slice(idx - 3, idx).reduce((a, b) => a + b, 0) / 3
      : h.slice(0, idx).reduce((a, b) => a + b, 0) / idx;
    const _bDate = idx < ds.length ? ds[idx] : new Date(ds[ds.length - 1].getTime() + 86400000);
    return r3 * si[_bDate.getDay()];
  }

  // --- Fourier Harmonic Regression (sin/cos + lag7 + OLS normal equations) ---
  function _mFourier(h, idx, ds) {
    if (idx < 1) return h[0];
    if (idx < 7) return _mMean7(h, idx);
    const P = 7;
    const rows = [];
    const yVec = [];
    for (let t = 1; t < idx; t++) {
      const dow = ds[t].getDay();
      const lag7 = t >= 7 ? h[t - 7] : h[0];
      rows.push([
        1,
        Math.sin(2 * Math.PI * 1 * dow / P),
        Math.cos(2 * Math.PI * 1 * dow / P),
        Math.sin(2 * Math.PI * 2 * dow / P),
        Math.cos(2 * Math.PI * 2 * dow / P),
        lag7
      ]);
      yVec.push(h[t]);
    }
    if (rows.length < 2) return _mMean7(h, idx);
    const nf = 6;
    const Xt = Array.from({length: nf}, (_, i) => rows.map(r => r[i]));
    const XtX = Array.from({length: nf}, (_, i) =>
      Array.from({length: nf}, (_, j) =>
        Xt[i].reduce((s, _, k) => s + Xt[i][k] * Xt[j][k], 0)
      )
    );
    const XtY = Xt.map(col => col.reduce((s, v, k) => s + v * yVec[k], 0));
    const inv = _matInv(XtX);
    if (!inv) return _mMean7(h, idx);
    const beta = _matVecMul(inv, XtY);
    const _fDate = idx < ds.length ? ds[idx] : new Date(ds[ds.length - 1].getTime() + 86400000);
    const tgtDow = _fDate.getDay();
    const lag7tgt = idx >= 7 ? h[idx - 7] : h[0];
    const xNew = [
      1,
      Math.sin(2 * Math.PI * 1 * tgtDow / P),
      Math.cos(2 * Math.PI * 1 * tgtDow / P),
      Math.sin(2 * Math.PI * 2 * tgtDow / P),
      Math.cos(2 * Math.PI * 2 * tgtDow / P),
      lag7tgt
    ];
    return xNew.reduce((s, x, i) => s + x * beta[i], 0);
  }

  // --- Holt-Winters Additive (level + trend + weekly seasonality) ---
  function _mHW(h, idx) {
    if (idx < 1) return h[0];
    if (idx < 14) {
      let e = h[0];
      const alpha = 0.3;
      for (let i = 1; i < idx; i++) e = alpha * h[i] + (1 - alpha) * e;
      return e;
    }
    const P = 7;
    const w = h.slice(0, idx);
    const wn = w.length;
    const fw = w.slice(0, P);
    let L = fw.reduce((a, b) => a + b, 0) / P;
    let T = 0;
    if (wn >= 2 * P) {
      const sw = w.slice(P, 2 * P);
      T = (sw.reduce((a, b) => a + b, 0) / P - L) / P;
    }
    const S = fw.map(v => v - L);
    const alpha = 0.3, beta2 = 0.1, gamma2 = 0.2;
    for (let t = P; t < wn; t++) {
      const si = t % P;
      const y = w[t];
      const Ln = alpha * (y - S[si]) + (1 - alpha) * (L + T);
      const Tn = beta2 * (Ln - L) + (1 - beta2) * T;
      S[si] = gamma2 * (y - Ln) + (1 - gamma2) * S[si];
      L = Ln; T = Tn;
    }
    return L + T + S[wn % P];
  }

  const _models = [
    { name: 'mean_7d',           fn: (h, i) => _mMean7(h, i) },
    { name: 'seasonal_naive',    fn: (h, i) => _mSNaive(h, i) },
    { name: 'ewma',              fn: (h, i) => _mEWMA(h, i) },
    { name: 'theta_lite',        fn: (h, i) => _mTheta(h, i, _dates, _sIdx) },
    { name: 'trend_season',      fn: (h, i) => _mTSBlend(h, i, _dates, _sIdx) },
    { name: 'fourier_regression', fn: (h, i) => _mFourier(h, i, _dates) },
    { name: 'holt_winters',      fn: (h, i) => _mHW(h, i) }
  ];

  const _split = computeTrainTestSplit(_n, timeSeries);
  if (!_split) return null;
  const _splitIndex = _split.split_index;
  const _trainVols = _vols.slice(0, _splitIndex);

  function _predictHoldout(model, idx) {
    if (idx < 1 || idx >= _n) return null;
    if (idx < _splitIndex) {
      return model.fn(_trainVols, idx);
    }
    return model.fn(_vols, idx);
  }

  function _buildHoldoutSeries(model) {
    const aligned = Array(_n).fill(null);
    for (let i = 1; i < _n; i++) {
      const p = _predictHoldout(model, i);
      if (p !== null && !isNaN(p)) aligned[i] = Math.round(p);
    }
    return aligned;
  }

  // ---- Holdout backtest (70/30 temporal split) ----
  const _mRes = _models.map(m => ({ name: m.name, errors: [], abs: [], preds: [], acts: [] }));
  const _naiveErr = [];

  for (let i = _splitIndex; i < _n; i++) {
    if (i >= 7) _naiveErr.push(Math.abs(_vols[i] - _vols[i - 7]));
    for (let mi = 0; mi < _models.length; mi++) {
      const p = _predictHoldout(_models[mi], i);
      if (p !== null && !isNaN(p)) {
        const e = _vols[i] - p;
        _mRes[mi].errors.push(e);
        _mRes[mi].abs.push(Math.abs(e));
        _mRes[mi].preds.push(Math.round(p));
        _mRes[mi].acts.push(_vols[i]);
      }
    }
  }

  const _naiveMAE = _naiveErr.length > 0 ? _naiveErr.reduce((a, b) => a + b, 0) / _naiveErr.length : _volStd;

  _mRes.forEach(mr => {
    if (mr.abs.length > 0) {
      mr.mae  = mr.abs.reduce((a, b) => a + b, 0) / mr.abs.length;
      mr.mase = _naiveMAE > 0 ? mr.mae / _naiveMAE : 999;
      mr.rmse = Math.sqrt(mr.errors.reduce((s, e) => s + e * e, 0) / mr.errors.length);
    } else { mr.mae = 999; mr.mase = 999; mr.rmse = 999; }
  });

  const _ranked = [..._mRes].sort((a, b) => a.mase - b.mase);
  const _best = _ranked[0];

  // ---- Ensemble (inverse-MASE weighted, top 3) ----
  const _top3 = _ranked.filter(m => m.mase < 999).slice(0, 3);
  const _totalInv = _top3.reduce((s, m) => s + 1 / Math.max(m.mase, 0.01), 0);
  const _ensW = _top3.map(m => ({
    name: m.name,
    weight: Math.round((1 / Math.max(m.mase, 0.01)) / _totalInv * 1000) / 1000
  }));

  const _fcasts = {};
  _models.forEach(m => {
    const p = m.fn(_vols, _n);
    if (p !== null && !isNaN(p)) _fcasts[m.name] = Math.round(Math.max(0, p));
  });

  let _ensFc = 0;
  _ensW.forEach(ew => { if (_fcasts[ew.name] !== undefined) _ensFc += _fcasts[ew.name] * ew.weight; });
  _ensFc = Math.round(Math.max(0, _ensFc));

  const _bestFc = _fcasts[_best.name] || _ensFc;
  const _useEns = _top3.length >= 2 && (_top3[1].mase / _top3[0].mase) < 1.2;
  const _selFc = _useEns ? _ensFc : _bestFc;
  const _selMethod = _useEns ? 'ensemble_weighted' : _best.name;

  // ---- Empirical intervals from backtest residuals ----
  const _residuals = _useEns
    ? _mRes.filter(m => _ensW.some(ew => ew.name === m.name)).flatMap(m => m.abs)
    : (_mRes.find(m => m.name === _best.name) || _mRes[0]).abs;

  const _sortedR = [..._residuals].sort((a, b) => a - b);

  function _quantile(sorted, q) {
    if (sorted.length === 0) return _volStd;
    const pos = (sorted.length - 1) * q;
    const lo = Math.floor(pos), hi = Math.ceil(pos);
    return lo === hi ? sorted[lo] : sorted[lo] + (pos - lo) * (sorted[hi] - sorted[lo]);
  }

  const _q50 = _quantile(_sortedR, 0.50);
  const _q80 = _quantile(_sortedR, 0.80);
  const _q95 = _quantile(_sortedR, 0.95);

  const _intervals = {
    band_50: { low: Math.round(Math.max(0, _selFc - _q50)), high: Math.round(_selFc + _q50) },
    band_80: { low: Math.round(Math.max(0, _selFc - _q80)), high: Math.round(_selFc + _q80) },
    band_95: { low: Math.round(Math.max(0, _selFc - _q95)), high: Math.round(_selFc + _q95) },
    residual_points: _sortedR.length
  };

  const _bestRes = _mRes.find(m => m.name === _best.name) || _mRes[0];
  let _covHits = 0;
  for (let i = 0; i < _bestRes.preds.length; i++) {
    if (Math.abs(_bestRes.acts[i] - _bestRes.preds[i]) <= _q80) _covHits++;
  }
  const _empCov = _bestRes.preds.length > 0 ? Math.round(_covHits / _bestRes.preds.length * 100) : 0;

  // --- Adaptive Conformal Inference (ACI) within backtest window ---
  let _aciAlpha = 0.2;
  const _aciGamma = 0.05;
  const _aciTargetAlpha = 0.2;
  const _aciResiduals = [..._sortedR];

  for (let bi = 0; bi < _bestRes.preds.length; bi++) {
    const _aciQ = _quantile(_aciResiduals, 1 - _aciAlpha);
    const _aciErr = Math.abs(_bestRes.acts[bi] - _bestRes.preds[bi]) > _aciQ ? 1 : 0;
    _aciAlpha = Math.max(0.01, Math.min(0.5, _aciAlpha + _aciGamma * (_aciTargetAlpha - _aciErr)));
  }

  const _aciQ80 = _quantile(_sortedR, 1 - _aciAlpha);
  const _aciIntervals = {
    aci_alpha: Math.round(_aciAlpha * 1000) / 1000,
    aci_band: { low: Math.round(Math.max(0, _selFc - _aciQ80)), high: Math.round(_selFc + _aciQ80) },
    aci_width_pct: _selFc > 0 ? Math.round(2 * _aciQ80 / _selFc * 10000) / 100 : 0,
    aci_vs_fixed: Math.round((2 * _aciQ80 - (_intervals.band_80.high - _intervals.band_80.low)) / Math.max(1, _intervals.band_80.high - _intervals.band_80.low) * 10000) / 100
  };

  // ---- Forecast horizons ----
  const _todayDow = new Date().getDay();
  const _horizons = {};
  _horizons.next_1d = {
    forecast: _selFc, band_low: _intervals.band_80.low, band_high: _intervals.band_80.high,
    confidence_pct: _empCov, method: _selMethod
  };
  let _s7 = 0; for (let d = 0; d < 7; d++) _s7 += _selFc * _sIdx[(_todayDow + d + 1) % 7];
  _s7 = Math.round(_s7);
  const _u7 = _q80 * Math.sqrt(7);
  _horizons.next_7d = {
    forecast: _s7, band_low: Math.round(Math.max(0, _s7 - _u7)),
    band_high: Math.round(_s7 + _u7), method: _selMethod + '+seasonal'
  };
  let _s14 = 0; for (let d = 0; d < 14; d++) _s14 += _selFc * _sIdx[(_todayDow + d + 1) % 7];
  _s14 = Math.round(_s14);
  const _u14 = _q80 * Math.sqrt(14);
  _horizons.next_14d = {
    forecast: _s14, band_low: Math.round(Math.max(0, _s14 - _u14)),
    band_high: Math.round(_s14 + _u14), method: _selMethod + '+seasonal'
  };

  // ---- Mode and confidence from backtest quality ----
  const _bMASE = _best.mase;
  if (_bMASE < 0.8) {
    predictionV2.mode = 'model'; predictionV2.confidence = 'alta';
    predictionV2.label = 'Forecast favorable vs baseline (' + _selMethod + ', MASE: ' + (Math.round(_bMASE * 100) / 100) + ')';
  } else if (_bMASE < 1.0) {
    predictionV2.mode = 'weak_model'; predictionV2.confidence = 'media';
    predictionV2.label = 'Forecast orientativo (' + _selMethod + ', MASE: ' + (Math.round(_bMASE * 100) / 100) + ')';
  } else {
    predictionV2.mode = 'observed_fallback'; predictionV2.confidence = 'baja';
    predictionV2.label = 'Forecast limitado - modelos no superan baseline (' + _selMethod + ', MASE: ' + (Math.round(_bMASE * 100) / 100) + ')';
    predictionV2.warning = 'Ningun modelo supera el baseline estacional (MASE >= 1.0). Se usa ' + _best.name + ' con confianza baja.';
  }

  predictionV2.recommended_value = _selFc;
  predictionV2.model_name = _selMethod;
  predictionV2.observed_forecast = {
    next_day: _selFc, band_low: _intervals.band_80.low, band_mid: _selFc,
    band_high: _intervals.band_80.high, next_7d_total: _horizons.next_7d.forecast, method: _selMethod
  };
  predictionV2.forecast_horizons = _horizons;
  predictionV2.intervals = _intervals;
  predictionV2.empirical_coverage_pct = _empCov;
  function _buildModelHorizons(modelName, fc1d, mr) {
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

  predictionV2.train_test_split = _split;
  predictionV2.backtest = {
    window_days: _split.test_count,
    train_test_split: _split,
    naive_mae: Math.round(_naiveMAE * 100) / 100,
    models: _ranked.map(m => {
      const mr = _mRes.find(x => x.name === m.name);
      const fc1d = _fcasts[m.name];
      const horizons = _buildModelHorizons(m.name, fc1d, mr);
      const model = _models.find(x => x.name === m.name);
      return {
        name: m.name,
        mae: Math.round(m.mae * 100) / 100,
        mase: Math.round(m.mase * 1000) / 1000,
        rmse: Math.round(m.rmse * 100) / 100,
        series: model ? _buildHoldoutSeries(model) : Array(_n).fill(null),
        forecast_1d: fc1d != null ? fc1d : null,
        horizons: horizons
      };
    }),
    selected: _selMethod, ensemble_weights: _useEns ? _ensW : null
  };

  return predictionV2.backtest || null;
}

function expectedModelPoints(_modelName, seriesLength, splitIndex) {
  if (splitIndex == null) return seriesLength;
  return Math.max(0, seriesLength - splitIndex);
}

function modelSeriesCoverage(series) {
  if (!Array.isArray(series)) return 0;
  return series.filter((v) => v != null && isFinite(v)).length;
}

function needsLinearEnrichment(payload) {
  const models = payload?.forecast?.backtest_models;
  const ts = payload?.forecast?.time_series || [];
  const n = ts.length;
  if (!Array.isArray(models) || !models.length || !n) return false;

  const split = payload.forecast.train_test_split || computeTrainTestSplit(n, ts);
  if (!split) return true;

  const expectedTest = expectedModelPoints(null, n, split.split_index);
  const minTrain = Math.max(1, split.split_index - 1);

  return models.some((m) => {
    if (!Array.isArray(m.series) || !m.series.some((v) => v != null)) return true;
    const trainCov = m.series.slice(0, split.split_index).filter((v) => v != null && isFinite(v)).length;
    const testCov = testZoneCoverage(m.series, split.split_index);
    return trainCov < minTrain * 0.5 || testCov < Math.max(1, expectedTest - 2);
  });
}

function enrichLinearForecastModels(payload, options = {}) {
  if (!payload?.forecast) return payload;
  const ts = payload.forecast.time_series;
  if (!ts?.length) return payload;
  if (!needsLinearEnrichment(payload) && !options.force) return payload;

  const result = computeLinearBacktestModels(ts, options.btWinMax || Math.max(14, ts.length - 14));
  if (!result?.models?.length) return payload;

  const split = computeTrainTestSplit(ts.length, ts);
  if (result.train_test_split) {
    payload.forecast.train_test_split = result.train_test_split;
  } else if (split) {
    payload.forecast.train_test_split = split;
  }

  const byName = new Map(result.models.map((m) => [m.name, m]));
  payload.forecast.backtest_models = (payload.forecast.backtest_models || []).map((existing) => {
    const computed = byName.get(existing.name);
    if (!computed) return existing;
    return {
      ...existing,
      series: computed.series,
      forecast_1d: computed.forecast_1d ?? existing.forecast_1d,
      horizons: computed.horizons ?? existing.horizons,
      mae: computed.mae ?? existing.mae,
      mase: computed.mase ?? existing.mase,
      rmse: computed.rmse ?? existing.rmse,
    };
  });

  if (!payload.forecast.backtest_models.length && result.models.length) {
    payload.forecast.backtest_models = result.models;
  }

  attachForecastTarget(payload);
  return payload;
}

module.exports = {
  computeLinearBacktestModels,
  needsLinearEnrichment,
  enrichLinearForecastModels,
  computeTrainTestSplit,
};
