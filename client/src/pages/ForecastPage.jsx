import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Area,
  AreaChart,
} from 'recharts';
import useDashboardStore from '../stores/useDashboardStore';
import KpiCard from '../components/shared/KpiCard';

export default function ForecastPage() {
  const { data, loading } = useDashboardStore();

  if (loading || !data) {
    return (
      <div className="loading-state">
        <div className="loading-spinner" />
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Cargando pronósticos...</p>
      </div>
    );
  }

  const forecast = data.forecast || {};
  const timeSeries = forecast.time_series || [];
  const models = forecast.model_leaderboard || forecast.models || [];
  const horizons = forecast.horizons || {};

  // Prepare chart data
  const chartData = useMemo(() => {
    return timeSeries.map((point) => ({
      date: point.date ? new Date(point.date).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' }) : '',
      leads: parseInt(point.value) || parseInt(point.leads) || 0,
      predicted: parseInt(point.predicted) || null,
    }));
  }, [timeSeries]);

  const tooltipStyle = {
    contentStyle: {
      background: 'rgba(13,20,35,0.95)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 12,
      fontSize: 12,
      color: '#f8fafc',
    },
  };

  return (
    <>
      {/* Horizon Cards */}
      <div className="section-header">
        <div className="section-title">
          <span className="bar" />
          Pronóstico de Demanda a Mediano Plazo
        </div>
      </div>
      <div className="grid-3">
        <KpiCard
          label="Pronóstico Mañana"
          value={horizons.tomorrow || forecast.recommended_value || 0}
          sub="Leads esperados mañana"
          color="blue"
          delay={0}
        />
        <KpiCard
          label="Pronóstico 7 Días"
          value={horizons.week_7d || 0}
          sub="Acumulado semanal"
          color="green"
          delay={0.05}
        />
        <KpiCard
          label="Pronóstico 14 Días"
          value={horizons.week_14d || 0}
          sub="Acumulado quincenal"
          color="gold"
          delay={0.1}
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
            Histórico de Leads y Predicción Temporal
          </div>
          <div className="chart-wrapper" style={{ height: 320 }}>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
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
                  <YAxis stroke="var(--text-dim)" fontSize={10} tickLine={false} />
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
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-dim)', fontSize: 13 }}>
                Sin datos de serie temporal disponibles
              </div>
            )}
          </div>
        </motion.div>

        {/* Seasonal chart placeholder */}
        <motion.div
          className="card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="chart-title">
            <span className="dot" style={{ background: 'var(--gold)' }} />
            Comportamiento Estacional Semanal
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

      {/* Model Leaderboard */}
      {models.length > 0 && (
        <motion.div
          className="card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          style={{ marginTop: 'var(--gap-bento)' }}
        >
          <div className="chart-title">
            <span className="dot" style={{ background: 'var(--gold)' }} />
            Clasificación de Modelos Predictivos
          </div>
          <div className="custom-table-container" style={{ marginTop: 12 }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Modelo de Proyección</th>
                  <th style={{ textAlign: 'right' }}>MASE</th>
                  <th style={{ textAlign: 'right' }}>MAE</th>
                  <th style={{ textAlign: 'right' }}>RMSE</th>
                  <th>Estado de Ajuste</th>
                </tr>
              </thead>
              <tbody>
                {models.map((m, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{m.model || m.name || '—'}</td>
                    <td style={{ textAlign: 'right', color: parseFloat(m.mase) < 1 ? 'var(--green)' : 'var(--red)' }}>
                      {m.mase || '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>{m.mae || '—'}</td>
                    <td style={{ textAlign: 'right' }}>{m.rmse || '—'}</td>
                    <td>
                      <span className={`badge ${parseFloat(m.mase) < 1 ? 'badge-success' : 'badge-warning'}`}>
                        {parseFloat(m.mase) < 1 ? 'Supera baseline' : 'No supera'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </>
  );
}
