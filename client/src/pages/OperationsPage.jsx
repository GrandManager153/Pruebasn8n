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
import KpiModal from '../components/shared/KpiModal';
import { resolveKpiShortHint } from '../data/kpiExplanations';

const CHART_HINTS = {
  dailyVolume: resolveKpiShortHint('Daily Volume (Volumen Diario de Leads)'),
  hourly: resolveKpiShortHint('Hourly Distribution (Distribución Horaria)'),
  contact: resolveKpiShortHint('Contact Distribution (Distribución de Contacto)'),
  capacity: resolveKpiShortHint('Forecast vs capacidad'),
};

export default function OperationsPage() {
  const { data, loading, error, fetchDashboard } = useDashboardStore();
  const [chartType, setChartType] = useState('bar');
  const [modal, setModal] = useState({ open: false, label: '', value: '' });

  const ops = data?.operations || {};
  const timeSeries = data?.forecast?.time_series || [];
  const hourly = ops.hourly_distribution || [];
  const contactDist = ops.contact_distribution || {};
  const isPending = loading && !data;
  const hasCallMetrics = Boolean(ops.call_metrics);

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
  const totalRecords = hasCallMetrics ? (callMetrics.total_records ?? null) : null;
  const uniqueContacts = hasCallMetrics ? (callMetrics.unique_contacts ?? null) : null;
  const attemptsAvg = hasCallMetrics && callMetrics.call_rank ? callMetrics.call_rank.avg : null;
  const intervalAvg = hasCallMetrics && callMetrics.minutes_since_prev ? callMetrics.minutes_since_prev.avg : null;
  const intervalSlaMin = 24 * 60;
  const intervalPair = (() => {
    if (intervalAvg == null) {
      return { actual: null, threshold: '24 h' };
    }
    const actual = Number(intervalAvg);
    const threshold = intervalSlaMin;
    if (!Number.isFinite(actual) || actual < 0) {
      return { actual: '—', threshold: '—' };
    }
    const scale = Math.max(actual, threshold);
    if (scale >= 2880) {
      const fmt = (m) => {
        const days = (m / 1440).toFixed(1);
        return `${days} ${Number(days) === 1 ? 'día' : 'días'}`;
      };
      return { actual: fmt(actual), threshold: fmt(threshold) };
    }
    if (scale >= 120) {
      const fmt = (m) => `${(m / 60).toFixed(1)} h`;
      return { actual: fmt(actual), threshold: fmt(threshold) };
    }
    return { actual: `${Math.round(actual)} min`, threshold: `${Math.round(threshold)} min` };
  })();
  const attemptsMax = callMetrics.call_rank ? callMetrics.call_rank.max : 368;
  const derived = ops.derived || {};
  const capacity = derived.forecast_vs_capacity || {};
  const pendingSub = isPending || !hasCallMetrics ? 'Esperando datos del CRM…' : undefined;

  const capacityLabel = capacity.label === 'critical'
    ? 'Presión crítica'
    : capacity.label === 'pressure'
      ? 'Bajo presión'
      : capacity.available
        ? 'Capacidad OK'
        : null;

  return (
    <>
      {isPending && (
        <div className="ops-data-banner ops-data-banner--loading">
          <span>Cargando métricas operativas… Las descripciones de cada cuadro ya están disponibles.</span>
          <div className="loading-spinner" style={{ width: 22, height: 22, borderWidth: 2, flexShrink: 0 }} />
        </div>
      )}
      {error && !isPending && (
        <div className="ops-data-banner ops-data-banner--error">
          <span>{error}. Puedes revisar qué mide cada indicador mientras se restablece la conexión.</span>
          <button type="button" onClick={() => fetchDashboard()}>Reintentar</button>
        </div>
      )}

      {capacityLabel && (
        <motion.div
          className="card"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            marginTop: 16,
            marginBottom: 8,
            borderLeft: `4px solid ${capacity.label === 'critical' ? 'var(--crimson)' : capacity.label === 'pressure' ? 'var(--amber)' : 'var(--green)'}`,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700 }}>Forecast vs capacidad: {capacityLabel}</div>
          {CHART_HINTS.capacity && (
            <p className="chart-desc" style={{ marginTop: 6, marginBottom: 0 }}>
              {CHART_HINTS.capacity}
            </p>
          )}
          {capacity.available && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '6px 0 0' }}>
              Pronóstico {capacity.forecast_value} leads/día vs promedio {capacity.avg_daily} (ratio {capacity.ratio})
            </p>
          )}
        </motion.div>
      )}

      {/* Little's Law */}
      {(() => {
        const ll = ops.littles_law || {};
        if (!ll.available) {
          return (
            <motion.div className="card" style={{ marginTop: 16, marginBottom: 8 }}>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Little&apos;s Law: datos insuficientes en el payload actual.
              </div>
            </motion.div>
          );
        }
        const pressureLabel = ll.staffing_pressure === 'critical' ? 'Crítica'
          : ll.staffing_pressure === 'pressure' ? 'Presión' : 'OK';
        return (
          <>
            <div className="section-header" style={{ marginTop: 24 }}>
              <div className="section-title">
                <span className="bar" />
                Little&apos;s Law (Teoría de colas)
              </div>
            </div>
            <div className="grid-4" style={{ marginBottom: 8 }}>
              <KpiCard
                label="Tasa de llegada (λ)"
                value={ll.arrival_rate_per_hour}
                suffix=" leads/h"
                decimals={2}
                sub="Promedio diario / 24"
                showHint
                color="blue"
                delay={0}
                onClick={() => setModal({
                  open: true,
                  label: 'Tasa de llegada (λ)',
                  value: `${ll.arrival_rate_per_hour} leads/h`,
                })}
              />
              <KpiCard
                label="Tiempo de servicio (W)"
                value={ll.avg_service_minutes}
                suffix=" min"
                decimals={1}
                sub="Duración media de llamada"
                showHint
                color="blue"
                delay={0.04}
                onClick={() => setModal({
                  open: true,
                  label: 'Tiempo de servicio (W)',
                  value: `${ll.avg_service_minutes} min`,
                })}
              />
              <KpiCard
                label="Cola estimada (L)"
                value={ll.estimated_queue_leads}
                decimals={1}
                sub="λ × W (Little)"
                showHint
                color="gold"
                delay={0.08}
                onClick={() => setModal({
                  open: true,
                  label: 'Cola estimada (L)',
                  value: String(ll.estimated_queue_leads),
                })}
              />
              <KpiCard
                label="Utilización"
                value={ll.utilization_pct}
                suffix="%"
                sub={`Capacidad: ${ll.capacity_leads_per_day || '—'} leads/día`}
                showHint
                color={ll.utilization_pct > 85 ? 'red' : 'green'}
                delay={0.12}
                onClick={() => setModal({
                  open: true,
                  label: 'Utilización',
                  value: `${ll.utilization_pct}%`,
                })}
              />
              <KpiCard
                label="Presión de staffing"
                value={pressureLabel}
                sub={ll.staffing_gap_tomorrow > 0
                  ? `Gap mañana: +${ll.staffing_gap_tomorrow} leads`
                  : 'Sin gap estimado'}
                showHint
                color={ll.staffing_pressure === 'critical' ? 'red' : ll.staffing_pressure === 'pressure' ? 'gold' : 'green'}
                delay={0.16}
                animateValue={false}
                onClick={() => setModal({
                  open: true,
                  label: 'Presión de staffing',
                  value: pressureLabel,
                })}
              />
            </div>
          </>
        );
      })()}

      {(derived.first_contact_rate != null || derived.sweet_spot_pct != null || derived.dial_efficiency != null || derived.overcontact_index != null) && (
        <div className="grid-4" style={{ marginTop: 16 }}>
          {derived.first_contact_rate != null && (
            <KpiCard
              label="First Contact Rate (Tasa de Primer Contacto)"
              value={derived.first_contact_rate * 100}
              suffix="%"
              decimals={1}
              sub="1.er intento / únicos"
              showHint
              color="green"
              delay={0}
              onClick={() => setModal({ open: true, label: 'First Contact Rate (Tasa de Primer Contacto)', value: `${(derived.first_contact_rate * 100).toFixed(1)}%` })}
            />
          )}
          {derived.sweet_spot_pct != null && (
            <KpiCard
              label="Sweet Spot % (Intentos 1–3)"
              value={derived.sweet_spot_pct}
              suffix="%"
              decimals={1}
              sub="Ventana óptima"
              showHint
              color="green"
              delay={0.04}
              onClick={() => setModal({ open: true, label: 'Sweet Spot % (Intentos 1–3)', value: `${derived.sweet_spot_pct}%` })}
            />
          )}
          {derived.dial_efficiency != null && (
            <KpiCard
              label="Dial Efficiency (Eficiencia de Marcación)"
              value={derived.dial_efficiency * 100}
              suffix="%"
              decimals={1}
              sub="Únicos / registros"
              showHint
              color="blue"
              delay={0.08}
              onClick={() => setModal({ open: true, label: 'Dial Efficiency (Eficiencia de Marcación)', value: `${(derived.dial_efficiency * 100).toFixed(1)}%` })}
            />
          )}
          {derived.overcontact_index != null && (
            <KpiCard
              label="Overcontact Index (Llamadas >7 est.)"
              value={derived.overcontact_index}
              sub="Estimado en periodo"
              showHint
              color="red"
              delay={0.12}
              onClick={() => setModal({ open: true, label: 'Overcontact Index (Llamadas >7 est.)', value: derived.overcontact_index.toLocaleString('es-MX') })}
            />
          )}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid-4" style={{ marginTop: 16 }}>
        <KpiCard
          label="Total Records (Registros de Llamadas)"
          value={totalRecords}
          sub={pendingSub || 'llamadas totales'}
          showHint
          pending={isPending || !hasCallMetrics}
          color="blue"
          delay={0}
          onClick={() => {
            setModal({
              open: true,
              label: 'Total Records (Registros de Llamadas)',
              value: totalRecords != null ? totalRecords.toLocaleString() : '—',
            });
          }}
        />
        <KpiCard
          label="Unique Leads (Contactos Únicos)"
          value={uniqueContacts}
          sub={pendingSub || 'leads únicos'}
          showHint
          pending={isPending || !hasCallMetrics}
          color="blue"
          delay={0.04}
          onClick={() => {
            setModal({
              open: true,
              label: 'Unique Leads (Contactos Únicos)',
              value: uniqueContacts != null ? uniqueContacts.toLocaleString() : '—',
            });
          }}
        />
        <KpiCard
          label="Avg Dial Attempts (Intentos Promedio)"
          value={attemptsAvg}
          decimals={2}
          sub={pendingSub || `rango: 1-${attemptsMax}`}
          showHint
          pending={isPending || attemptsAvg == null}
          color={attemptsAvg != null && attemptsAvg > 7 ? 'red' : 'blue'}
          delay={0.08}
          onClick={() => {
            setModal({
              open: true,
              label: 'Avg Dial Attempts (Intentos Promedio)',
              value: attemptsAvg != null
                ? attemptsAvg.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : '—',
            });
          }}
        />
        <KpiCard
          label="Avg Callback Interval (Demora entre Re-intentos)"
          value={intervalPair.actual}
          sub={pendingSub || `objetivo: ≤${intervalPair.threshold}`}
          showHint
          pending={isPending || intervalAvg == null}
          color={intervalAvg != null && intervalAvg > 1440 ? 'red' : 'blue'}
          delay={0.12}
          onClick={() => {
            setModal({
              open: true,
              label: 'Avg Callback Interval (Demora entre Re-intentos)',
              value: intervalAvg != null
                ? `${intervalPair.actual} (objetivo: ≤${intervalPair.threshold})`
                : '—',
            });
          }}
        />
      </div>

      {/* Daily Volume Chart */}
      <motion.div
        className="card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{ marginTop: 'var(--gap-bento)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div className="chart-title" style={{ marginBottom: 0 }}>
            <span className="dot" style={{ background: '#3b82f6' }} />
            Daily Volume (Volumen Diario de Leads)
          </div>
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
        {CHART_HINTS.dailyVolume && (
          <p className="chart-desc">{CHART_HINTS.dailyVolume}</p>
        )}
        <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 12 }}>
          {isPending
            ? 'Esperando serie temporal…'
            : `${dailyData.length} días | Promedio: ${Math.round(ops.avg_daily || 0)} leads/día`}
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
      </motion.div>

      {/* Hourly + Contact Distribution */}
      <div className="grid-2" style={{ marginTop: 'var(--gap-bento)' }}>
        <motion.div className="card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <div className="chart-title" style={{ marginBottom: 4 }}>
            <span className="dot" style={{ background: '#ef4444' }} />
            Hourly Distribution (Distribución Horaria)
          </div>
          {CHART_HINTS.hourly && (
            <p className="chart-desc">{CHART_HINTS.hourly}</p>
          )}
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
        </motion.div>

        <motion.div className="card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="chart-title">
            <span className="dot" style={{ background: 'var(--gold)' }} />
            Contact Distribution (Distribución de Contacto)
          </div>
          {CHART_HINTS.contact && (
            <p className="chart-desc">{CHART_HINTS.contact}</p>
          )}
          <p id="contact-total-calls" style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 12 }}>
            {totalRecords != null
              ? `${totalRecords.toLocaleString()} llamadas totales`
              : 'Esperando datos de llamadas…'}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {totalRecords == null ? (
              <p style={{ fontSize: 12.5, color: 'var(--text-dim)', margin: 0 }}>
                La distribución aparecerá cuando lleguen los datos del CRM.
              </p>
            ) : (
            [
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
            })
            )}
          </div>
          {contactDist.overcontact_pct && (
            <div id="contact-overcontact-warning-text" style={{ marginTop: 16, fontSize: 12, fontWeight: 700, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>⚠️</span>
              <span>{contactDist.overcontact_pct}% de llamadas exceden el sweet spot de intentos</span>
            </div>
          )}
        </motion.div>
      </div>

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
