import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Area,
  AreaChart,
  BarChart,
  Bar,
} from 'recharts';
import useDashboardStore from '../stores/useDashboardStore';
import KpiCard from '../components/shared/KpiCard';
import KpiModal from '../components/shared/KpiModal';

const MODEL_COLORS = {
  theta_lite: '#38bdf8',
  holt_winters: '#f472b6',
  trend_season: '#f59e0b',
  seasonal_naive: '#a78bfa',
  fourier_regression: '#34d399',
  mean_7d: '#fb7185',
  ewma: '#facc15',
  random_forest: '#10b981',
  gradient_boosting: '#f97316',
  mlp_neural_network: '#ec4899',
};

const ML_MODEL_NAMES = [
  'random_forest',
  'gradient_boosting',
  'ridge',
  'mlp_neural_network',
  'lightgbm',
  'autoets',
];

function getModelColor(name) {
  if (!name) return '#f472b6';
  if (MODEL_COLORS[name]) return MODEL_COLORS[name];
  let h = 0;
  for (const c of String(name)) h = (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0;
  return `hsl(${h % 360}, 70%, 62%)`;
}

function cleanTechnicalTerms(name) {
  if (!name) return '';
  return name.replace(/_/g, ' ').toUpperCase();
}

function buildRfAlignedSeries(data) {
  const rf = data ? data.forecast_rf : null;
  if (!rf || !Array.isArray(rf.backtest_series) || !rf.backtest_series.length) return null;
  const baseTs = (data.forecast && Array.isArray(data.forecast.time_series) && data.forecast.time_series.length)
    ? data.forecast.time_series
    : (Array.isArray(rf.time_series) ? rf.time_series : []);
  if (!baseTs.length) return null;
  const predByDate = {};
  rf.backtest_series.forEach(p => {
    if (p && p.date != null) predByDate[String(p.date).split('T')[0]] = p.predicted;
  });
  const aligned = baseTs.map(d => {
    const key = String(d.date).split('T')[0];
    return (key in predByDate) ? predByDate[key] : null;
  });
  return aligned.some(v => v != null) ? aligned : null;
}

function buildComparableModels(data) {
  const list = [];
  const f = (data && data.forecast) ? data.forecast : {};
  (f.backtest_models || []).forEach(m => {
    list.push({ name: m.name, mase: m.mase, mae: m.mae, rmse: m.rmse, series: m.series, forecast_1d: m.forecast_1d, horizons: m.horizons });
  });

  const rf = data ? data.forecast_rf : null;
  if (rf && rf.available !== false) {
    const rfName = rf.model_name || 'random_forest';
    if (!list.some(m => m.name === rfName)) {
      let series = Array.isArray(rf.series) ? rf.series : null;
      if (!series && Array.isArray(rf.backtest_models)) {
        const e = rf.backtest_models.find(x => x.name === rfName);
        if (e && Array.isArray(e.series)) series = e.series;
      }
      if (!series) series = buildRfAlignedSeries(data);
      list.push({
        name: rfName,
        mase: rf.mase,
        series,
        forecast_1d: rf.recommended_value ?? rf.horizons?.next_1d?.forecast,
        horizons: rf.horizons,
      });
    }
    (rf.backtest_models || []).forEach(m => {
      const key = m.name;
      if (ML_MODEL_NAMES.indexOf(key) < 0 && key !== rfName) return;
      let series = Array.isArray(m.series) ? m.series : null;
      if (!series && key === rfName) series = buildRfAlignedSeries(data);
      const isPrimary = key === rfName;
      const existing = list.find(x => x.name === key);
      const entry = {
        name: key,
        mase: m.mase ?? (isPrimary ? rf.mase : null),
        mae: m.mae,
        rmse: m.rmse,
        series,
        forecast_1d: m.forecast_1d ?? (isPrimary ? (rf.recommended_value ?? rf.horizons?.next_1d?.forecast) : null),
        horizons: m.horizons || (isPrimary ? rf.horizons : null),
      };
      if (existing) Object.assign(existing, entry);
      else list.push(entry);
    });
  }
  return list;
}

function getMaseMetricClass(mase) {
  if (typeof mase !== 'number' || !isFinite(mase)) return 'metric-mase-warn';
  if (mase < 0.85) return 'metric-mase-good';
  if (mase < 1.0) return 'metric-mase-warn';
  return 'metric-mase-bad';
}

export default function ForecastPage() {
  const { data, loading } = useDashboardStore();
  const [selectedCompareModel, setSelectedCompareModel] = useState('');
  const [showAllModels, setShowAllModels] = useState(false);
  const [chartType, setChartType] = useState('line');
  const [modal, setModal] = useState({ open: false, label: '', value: '' });

  const forecast = data?.forecast || {};
  const timeSeries = forecast.time_series || [];
  const horizons = forecast.horizons || {};
  const changepoint = forecast.changepoint || {};

  const h1d = horizons.next_1d || {};
  const h7d = horizons.next_7d || {};
  const h14d = horizons.next_14d || {};

  const baseName = forecast.method || '';
  const comparableModelsList = useMemo(() => {
    if (!data) return [];
    return buildComparableModels(data).filter(m => m.name !== baseName);
  }, [data, baseName]);

  const comparableModelsSorted = useMemo(() => {
    if (!data) return [];
    return buildComparableModels(data).sort((a, b) => {
      const maseA = a.mase != null ? a.mase : 999;
      const maseB = b.mase != null ? b.mase : 999;
      return maseA - maseB;
    });
  }, [data]);

  const activeOverlays = useMemo(() => {
    if (!data) return [];
    const modelsList = buildComparableModels(data).filter(
      (m) => m.name !== baseName && Array.isArray(m.series) && m.series.length
    );
    if (showAllModels) {
      return modelsList;
    }
    if (selectedCompareModel) {
      const m = modelsList.find((x) => x.name === selectedCompareModel);
      if (m) return [m];
    }
    return [];
  }, [data, baseName, showAllModels, selectedCompareModel]);

  const chartData = useMemo(() => {
    return timeSeries.map((point, index) => {
      const item = {
        date: point.date ? new Date(point.date).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' }) : '',
        leads: parseInt(point.value) || parseInt(point.leads) || 0,
        predicted: parseInt(point.predicted) || null,
      };
      activeOverlays.forEach((overlay) => {
        if (overlay.series && overlay.series[index] !== undefined && overlay.series[index] !== null) {
          item[overlay.name] = Math.round(overlay.series[index]);
        }
      });
      return item;
    });
  }, [timeSeries, activeOverlays]);

  const yAxisDomain = useMemo(() => {
    const nums = [];
    chartData.forEach((row) => {
      Object.entries(row).forEach(([key, val]) => {
        if (key === 'date') return;
        if (val != null && isFinite(Number(val))) nums.push(Number(val));
      });
    });
    if (!nums.length) return [0, 'auto'];
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const span = Math.max(max - min, 1);
    const pad = Math.max(span * 0.1, 8);
    return [Math.floor(min - pad), Math.ceil(max + pad)];
  }, [chartData]);

  const tooltipStyle = {
    contentStyle: {
      background: 'rgba(13,20,35,0.95)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 12,
      fontSize: 12,
      color: '#f8fafc',
    },
  };

  if (loading || !data) {
    return (
      <div className="loading-state">
        <div className="loading-spinner" />
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Cargando pronósticos...</p>
      </div>
    );
  }

  return (
    <>
      {/* Regime Shift / Changepoint Banner */}
      {changepoint.detected ? (
        <motion.div
          className="card"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            background: `linear-gradient(135deg, var(--bg-card), ${changepoint.direction === 'upward' ? '#25200b' : '#300f0d'})`,
            borderLeft: `4px solid ${changepoint.direction === 'upward' ? 'var(--amber)' : 'var(--red)'}`,
            padding: '24px',
            marginBottom: 'var(--gap-bento)',
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 8px 0', color: 'white' }}>
            Cambio Estructural de Demanda Detectado
          </h2>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
            Identificado a partir del {changepoint.change_date}. El volumen medio de leads diarios transitó de {changepoint.pre_mean} a {changepoint.post_mean} contactos diarios, representando una variación del {changepoint.shift_pct}%.
          </p>
        </motion.div>
      ) : (
        <div
          style={{
            padding: 16,
            textAlign: 'center',
            color: 'var(--text-dim)',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            fontSize: 13,
            marginBottom: 'var(--gap-bento)',
          }}
        >
          No se han detectado variaciones o quiebres estructurales significativos en la demanda durante este periodo.
        </div>
      )}

      {/* Horizon Cards */}
      <div className="section-header">
        <div className="section-title">
          <span className="bar" />
          Mid-Term Forecast (Pronóstico de Demanda a Mediano Plazo)
        </div>
      </div>
      <div className="grid-3">
        <KpiCard
          label="Daily Forecast (Pronóstico Mañana)"
          value={h1d.forecast ?? forecast.recommended_value ?? 0}
          sub={h1d.band_low !== undefined ? `Rango: ${h1d.band_low} a ${h1d.band_high} leads` : 'Leads esperados mañana'}
          color="blue"
          delay={0}
          onClick={() => setModal({ open: true, label: 'Daily Forecast (Pronóstico Mañana)', value: (h1d.forecast ?? forecast.recommended_value ?? 0).toLocaleString() })}
        />
        <KpiCard
          label="7-Day Forecast (Pronóstico 7 Días)"
          value={h7d.forecast ?? 0}
          sub={h7d.band_low !== undefined ? `Rango: ${h7d.band_low} a ${h7d.band_high} leads` : 'Acumulado semanal'}
          color="green"
          delay={0.05}
          onClick={() => setModal({ open: true, label: '7-Day Forecast (Pronóstico 7 Días)', value: (h7d.forecast ?? 0).toLocaleString() })}
        />
        <KpiCard
          label="14-Day Forecast (Pronóstico 14 Días)"
          value={h14d.forecast ?? 0}
          sub={h14d.band_low !== undefined ? `Rango: ${h14d.band_low} a ${h14d.band_high} leads` : 'Acumulado quincenal'}
          color="gold"
          delay={0.1}
          onClick={() => setModal({ open: true, label: '14-Day Forecast (Pronóstico 14 Días)', value: (h14d.forecast ?? 0).toLocaleString() })}
        />
      </div>

      {/* Time Series Chart */}
      <div className="grid-2-1" style={{ marginTop: 'var(--gap-bento)' }}>
        <motion.div
          className="card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <div className="chart-title">
            <span className="dot" style={{ background: '#3b82f6' }} />
            Historical & Projection (Histórico de Leads y Predicción Temporal)
          </div>

          {/* Model Comparison Controls Row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)' }}>Comparar modelo:</label>
            <select
              value={selectedCompareModel}
              onChange={(e) => {
                setSelectedCompareModel(e.target.value);
                setShowAllModels(false);
              }}
              style={{
                padding: '5px 10px',
                borderRadius: 6,
                border: '1px solid var(--border)',
                background: 'rgba(255,255,255,0.03)',
                color: 'var(--text-main)',
                fontSize: 11,
                fontFamily: 'var(--font)'
              }}
            >
              <option value="">Ninguno (solo modelo actual)</option>
              {comparableModelsList.map(m => (
                <option key={m.name} value={m.name} style={{ color: getModelColor(m.name) }}>
                  {cleanTechnicalTerms(m.name)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                setShowAllModels(true);
                setSelectedCompareModel('');
              }}
              style={{
                padding: '5px 12px',
                borderRadius: 6,
                border: '1px solid var(--chartreuse)',
                background: 'var(--chartreuse)',
                color: '#080c14',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Mostrar todas
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAllModels(false);
                setSelectedCompareModel('');
              }}
              style={{
                padding: '5px 12px',
                borderRadius: 6,
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text-muted)',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Limpiar
            </button>
            {showAllModels && (
              <span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 500 }}>
                Mostrando todos los modelos
              </span>
            )}
            {selectedCompareModel && (
              <span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 500 }}>
                Comparando con: {cleanTechnicalTerms(selectedCompareModel)}
              </span>
            )}

            {/* Line / Bar Switcher */}
            <div className="chart-toolbar" style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
              <button
                className={`chart-tool-btn ${chartType === 'line' ? 'active' : ''}`}
                onClick={() => setChartType('line')}
                title="Vista de línea"
                style={{
                  width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)',
                  background: chartType === 'line' ? 'var(--chartreuse)' : 'transparent',
                  color: chartType === 'line' ? '#080c14' : 'var(--text-dim)',
                  fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                ∿
              </button>
              <button
                className={`chart-tool-btn ${chartType === 'bar' ? 'active' : ''}`}
                onClick={() => setChartType('bar')}
                title="Vista de barras"
                style={{
                  width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)',
                  background: chartType === 'bar' ? 'var(--chartreuse)' : 'transparent',
                  color: chartType === 'bar' ? '#080c14' : 'var(--text-dim)',
                  fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                ▮
              </button>
            </div>
          </div>

          <div className="chart-wrapper" style={{ height: 320 }}>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                {chartType === 'line' ? (
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="gradLeads" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradPred" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#e0992a" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#e0992a" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis
                      dataKey="date"
                      stroke="var(--text-dim)"
                      fontSize={10}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis stroke="var(--text-dim)" fontSize={10} tickLine={false} domain={yAxisDomain} />
                    <Tooltip {...tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area
                      type="monotone"
                      dataKey="leads"
                      stroke="#3b82f6"
                      fill="url(#gradLeads)"
                      strokeWidth={2}
                      name="Leads Reales"
                      dot={false}
                    />
                    {chartData.some((d) => d.predicted) && (
                      <Area
                        type="monotone"
                        dataKey="predicted"
                        stroke="#e0992a"
                        fill="url(#gradPred)"
                        strokeWidth={2}
                        strokeDasharray="5 3"
                        name="Predicción"
                        dot={false}
                      />
                    )}
                    {activeOverlays.map((overlay) => (
                      <Line
                        key={overlay.name}
                        type="monotone"
                        dataKey={overlay.name}
                        stroke={getModelColor(overlay.name)}
                        strokeWidth={2}
                        dot={false}
                        name={cleanTechnicalTerms(overlay.name)}
                      />
                    ))}
                  </AreaChart>
                ) : (
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis
                      dataKey="date"
                      stroke="var(--text-dim)"
                      fontSize={10}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis stroke="var(--text-dim)" fontSize={10} tickLine={false} domain={yAxisDomain} />
                    <Tooltip {...tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="leads" fill="#3b82f6" radius={[2, 2, 0, 0]} name="Leads Reales" />
                    <Bar dataKey="predicted" fill="#e0992a" radius={[2, 2, 0, 0]} name="Predicción" />
                    {activeOverlays.map((overlay) => (
                      <Bar
                        key={overlay.name}
                        dataKey={overlay.name}
                        fill={getModelColor(overlay.name)}
                        radius={[2, 2, 0, 0]}
                        name={cleanTechnicalTerms(overlay.name)}
                      />
                    ))}
                  </BarChart>
                )}
              </ResponsiveContainer>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-dim)', fontSize: 13 }}>
                Sin datos de serie temporal disponibles
              </div>
            )}
          </div>
        </motion.div>

        {/* Seasonal Chart */}
        <motion.div
          className="card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="chart-title">
            <span className="dot" style={{ background: 'var(--gold)' }} />
            Weekly Seasonality (Comportamiento Estacional Semanal)
          </div>
          <div className="chart-wrapper" style={{ height: 320 }}>
            {forecast.seasonal ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={
                  (forecast.seasonal || []).map((val, i) => ({
                    day: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][i] || `D${i}`,
                    index: typeof val === 'number' ? val : parseFloat(val) || 0,
                  }))
                }>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="day" stroke="var(--text-dim)" fontSize={11} tickLine={false} />
                  <YAxis stroke="var(--text-dim)" fontSize={10} tickLine={false} />
                  <Tooltip {...tooltipStyle} />
                  <Bar dataKey="index" fill="var(--gold)" radius={[4, 4, 0, 0]} name="Índice Estacional" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-dim)', fontSize: 13 }}>
                Datos estacionales no disponibles
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Model Leaderboard Table */}
      <motion.div
        className="card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        style={{ marginTop: 'var(--gap-bento)' }}
      >
        <div className="chart-title">
          <span className="dot" style={{ background: 'var(--violet)' }} />
          Modelos en Gráfica / Comparador de Modelos
        </div>
        <div className="custom-table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Modelo</th>
                <th style={{ textAlign: 'right' }}>Pron.</th>
                <th style={{ textAlign: 'right' }}>MASE</th>
                <th style={{ textAlign: 'right' }}>MAE</th>
                <th style={{ textAlign: 'right' }}>RMSE</th>
              </tr>
            </thead>
            <tbody>
              {comparableModelsSorted.length > 0 ? (
                comparableModelsSorted.map((m, idx) => {
                  const maseClass = getMaseMetricClass(m.mase);
                  const color = getModelColor(m.name);
                  const isBest = idx === 0;
                  return (
                    <tr key={idx} className={isBest ? 'model-row-best' : ''}>
                      <td style={{ fontWeight: 600, color }}>
                        {cleanTechnicalTerms(m.name)}
                        {isBest && <span className="best-model-tag" style={{ marginLeft: 8, fontSize: 10, padding: '2px 6px', background: 'var(--green)', color: '#080c14', borderRadius: 4, fontWeight: 800 }}>MEJOR MODELO</span>}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>{m.forecast_1d != null ? Math.round(m.forecast_1d) : '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold' }} className={maseClass}>
                        {m.mase != null ? m.mase.toFixed(3) : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>{m.mae != null ? m.mae.toFixed(2) : '—'}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>{m.rmse != null ? m.rmse.toFixed(2) : '—'}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-dim)', padding: 24 }}>
                    No hay modelos comparables disponibles
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Explanation Modal */}
      <KpiModal
        isOpen={modal.open}
        label={modal.label}
        value={modal.value}
        onClose={() => setModal({ open: false, label: '', value: '' })}
      />
    </>
  );
}
