import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  ComposedChart,
  Line,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import useDashboardStore from '../stores/useDashboardStore';
import KpiCard from '../components/shared/KpiCard';

export default function OperationsPage() {
  const { data, loading } = useDashboardStore();
  const [chartType, setChartType] = useState('bar');

  if (loading || !data) {
    return (
      <div className="loading-state">
        <div className="loading-spinner" />
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Cargando operaciones...</p>
      </div>
    );
  }

  const ops = data.operations || {};
  const timeSeries = data.forecast?.time_series || [];
  const hourly = ops.hourly_distribution || [];
  const contactDist = ops.contact_distribution || {};

  // Daily volume chart data
  const dailyData = useMemo(() => {
    const source = ops.daily_volumes || timeSeries || [];
    return source.map((d) => {
      let dateLabel = '';
      if (d.date) {
        const parts = d.date.split('-');
        if (parts.length === 3) {
          const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
          const mIdx = parseInt(parts[1]) - 1;
          dateLabel = `${parts[2]}-${months[mIdx] || parts[1]}`;
        } else {
          dateLabel = new Date(d.date).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' });
        }
      }
      return {
        date: dateLabel,
        leads: parseInt(d.leads) || parseInt(d.value) || 0,
        avg: parseFloat(ops.avg_daily) || 0,
      };
    });
  }, [ops.daily_volumes, timeSeries, ops.avg_daily]);

  // Hourly chart data
  const hourlyData = useMemo(() => {
    if (!Array.isArray(hourly)) return [];
    const values = hourly.map(h => h.probability !== undefined ? (h.probability * 100) : 0);
    const maxVal = values.length > 0 ? Math.max(...values) : 0;

    return hourly.map((h, i) => {
      const val = h.probability !== undefined ? (h.probability * 100) : 0;
      return {
        hour: h.label || `${h.hour !== undefined ? h.hour : i}:00`,
        calls: val,
        isPeak: val === maxVal && maxVal > 0,
      };
    });
  }, [hourly]);

  const tooltipStyle = {
    contentStyle: {
      background: 'rgba(13,20,35,0.95)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 12,
      fontSize: 12,
      color: '#f8fafc',
    },
  };

  const callMetrics = ops.call_metrics || {};
  const totalRecords = callMetrics.total_records || 0;
  const uniqueContacts = callMetrics.unique_contacts || 0;
  const attemptsAvg = callMetrics.call_rank ? callMetrics.call_rank.avg : 0;
  const intervalAvg = callMetrics.minutes_since_prev ? callMetrics.minutes_since_prev.avg : 0;
  const attemptsMax = callMetrics.call_rank ? callMetrics.call_rank.max : 368;

  return (
    <>
      <div className="grid-4" style={{ marginTop: 'var(--gap-bento)' }}>
        <KpiCard
          label="Registros"
          value={totalRecords}
          sub="llamadas totales"
          color="blue"
          delay={0}
        />
        <KpiCard
          label="Contactos"
          value={uniqueContacts}
          sub="leads únicos"
          color="blue"
          delay={0.04}
        />
        <KpiCard
          label="Avg Dial Attempts (intentos promedio)"
          value={attemptsAvg}
          decimals={2}
          sub={`rango: 1-${attemptsMax}`}
          color={attemptsAvg > 7 ? 'red' : 'blue'}
          delay={0.08}
        />
        <KpiCard
          label="Avg Callback Interval (min entre intentos)"
          value={Math.round(intervalAvg)}
          suffix=" min"
          sub={`~${Math.round(intervalAvg / 60)}h entre marcaciones`}
          color={intervalAvg > 1440 ? 'red' : 'blue'}
          delay={0.12}
        />
      </div>

      {/* Daily Volume Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{ marginTop: 'var(--gap-bento)' }}
      >
        <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div className="chart-title" style={{ marginBottom: 0 }}>
            <span className="dot" style={{ background: '#3b82f6' }} />
            Volumen Diario
          </div>
          {/* Line / Bar Switcher */}
          <div className="chart-toolbar" style={{ display: 'flex', gap: 4 }}>
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
        <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 12 }}>
          {dailyData.length} días | Promedio: {Math.round(ops.avg_daily || 0)} leads/día
        </p>
        <div className="chart-wrapper" style={{ height: 280 }}>
          {dailyData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dailyData}>
                <defs>
                  <linearGradient id="gradDailyLeads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" stroke="var(--text-dim)" fontSize={10} tickLine={false} interval="preserveStartEnd" />
                <YAxis stroke="var(--text-dim)" fontSize={10} tickLine={false} />
                <Tooltip {...tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                
                {chartType === 'bar' ? (
                  <Bar dataKey="leads" fill="#38bdf8" radius={[3, 3, 0, 0]} name="Leads Recibidos" />
                ) : (
                  <Area
                    type="monotone"
                    dataKey="leads"
                    stroke="#38bdf8"
                    fill="url(#gradDailyLeads)"
                    strokeWidth={2}
                    name="Leads Recibidos"
                    dot={{ r: 2 }}
                    activeDot={{ r: 6 }}
                  />
                )}
                
                <Line
                  type="monotone"
                  dataKey="avg"
                  stroke="#e0992a"
                  strokeDasharray="5 5"
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={false}
                  name="Promedio Diario"
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-dim)', fontSize: 13 }}>
              Sin datos de volumen diario
            </div>
          )}
        </div>
        </div>
      </motion.div>

      {/* Hourly + Contact Distribution */}
      <div className="grid-2" style={{ marginTop: 'var(--gap-bento)' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <div className="card">
          <div className="chart-title" style={{ marginBottom: 4 }}>
            <span className="dot" style={{ background: '#ef4444' }} />
            Distribución Horaria
          </div>
          {ops.peak_hour !== undefined && (
            <p id="hourly-chart-sub" style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 12 }}>
              Pico: {String(ops.peak_hour).padStart(2, '0')}:00 | Valle: {String(ops.valley_hour !== undefined ? ops.valley_hour : 3).padStart(2, '0')}:00
            </p>
          )}
          <div className="chart-wrapper" style={{ height: 240 }}>
            {hourlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="hour" stroke="var(--text-dim)" fontSize={9} tickLine={false} />
                  <YAxis stroke="var(--text-dim)" fontSize={10} tickLine={false} tickFormatter={(v) => `${v}%`} />
                  <Tooltip {...tooltipStyle} formatter={(value) => [`${value.toFixed(2)}%`, 'Proporción']} />
                  <Bar dataKey="calls" radius={[3, 3, 0, 0]} name="Proporción">
                    {hourlyData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.isPeak ? 'var(--red)' : '#ef4444'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-dim)', fontSize: 13 }}>
                Sin datos horarios
              </div>
            )}
          </div>
        </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="card">
          <div className="chart-title">
            <span className="dot" style={{ background: 'var(--gold)' }} />
            Distribución de Contacto
          </div>
          <p id="contact-total-calls" style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 12 }}>
            {totalRecords.toLocaleString()} llamadas totales
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              {
                label: '1er intento',
                val: contactDist.first_attempts || 0,
                color: 'var(--green)'
              },
              {
                label: '1-3 intentos',
                val: contactDist.attempts_1_to_3 || 0,
                color: 'var(--blue)'
              },
              {
                label: '1-5 intentos',
                val: contactDist.attempts_1_to_5 || 0,
                color: 'var(--gold)'
              },
              {
                label: '>7 (sobre-contacto)',
                val: contactDist.overcontact_calls || 0,
                color: 'var(--red)'
              }
            ].map((item, i) => {
              const totalCalls = totalRecords || 1;
              const pct = ((item.val / totalCalls) * 100).toFixed(1);
              return (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)' }}>
                    <span>{item.label}</span>
                    <span style={{ fontFamily: 'var(--mono)', color: 'var(--text-main)' }}>
                      {item.val.toLocaleString()} ({pct}%)
                    </span>
                  </div>
                  <div className="progress-bar-track" style={{ height: 8, background: 'rgba(255,255,255,0.03)', borderRadius: 4, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.02)' }}>
                    <motion.div
                      className="progress-bar-fill"
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ delay: 0.3 + i * 0.05, duration: 0.6 }}
                      style={{ height: '100%', background: item.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {contactDist.overcontact_pct && (
            <div id="contact-overcontact-warning-text" style={{ marginTop: 16, fontSize: 12, fontWeight: 700, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>⚠️</span>
              <span>{contactDist.overcontact_pct}% de llamadas exceden el sweet spot de intentos</span>
            </div>
          )}
        </div>
        </motion.div>
      </div>
    </>
  );
}
