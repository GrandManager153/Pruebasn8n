import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import useDashboardStore from '../../stores/useDashboardStore';
import KpiCard from '../shared/KpiCard';

export default function OperationsPage() {
  const { data, loading } = useDashboardStore();

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
    return timeSeries.map((d) => ({
      date: d.date ? new Date(d.date).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' }) : '',
      leads: parseInt(d.value) || parseInt(d.leads) || 0,
    }));
  }, [timeSeries]);

  // Hourly chart data
  const hourlyData = useMemo(() => {
    if (Array.isArray(hourly)) {
      return hourly.map((val, i) => ({
        hour: `${i}:00`,
        calls: typeof val === 'number' ? val : parseInt(val) || 0,
      }));
    }
    return Object.entries(hourly).map(([h, v]) => ({
      hour: `${h}:00`,
      calls: parseInt(v) || 0,
    }));
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

  // KPI cards for operations
  const kpis = [
    { label: 'Registros', value: ops.total_records || 0, color: 'blue' },
    { label: 'Contactos', value: ops.unique_contacts || 0, color: 'green' },
    { label: 'Leads Hoy', value: ops.latest?.leads || ops.today_leads || 0, color: 'gold' },
    { label: 'Máximo Diario', value: ops.max_daily || 0, color: 'red' },
  ];

  return (
    <>
      {/* KPI Cards */}
      <div className="grid-4" style={{ marginTop: 16 }}>
        {kpis.map((k, i) => (
          <KpiCard key={k.label} label={k.label} value={k.value} color={k.color} delay={i * 0.04} />
        ))}
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
            Volumen Diario
          </div>
        </div>
        <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 12 }}>
          {dailyData.length} días | Promedio: {ops.avg_daily || 0} leads/día
        </p>
        <div className="chart-wrapper" style={{ height: 280 }}>
          {dailyData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" stroke="var(--text-dim)" fontSize={10} tickLine={false} interval="preserveStartEnd" />
                <YAxis stroke="var(--text-dim)" fontSize={10} tickLine={false} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="leads" fill="#3b82f6" radius={[3, 3, 0, 0]} name="Leads" />
              </BarChart>
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
          <div className="chart-title">
            <span className="dot" style={{ background: '#ef4444' }} />
            Distribución Horaria
          </div>
          <div className="chart-wrapper" style={{ height: 240 }}>
            {hourlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="hour" stroke="var(--text-dim)" fontSize={9} tickLine={false} />
                  <YAxis stroke="var(--text-dim)" fontSize={10} tickLine={false} />
                  <Tooltip {...tooltipStyle} />
                  <Bar dataKey="calls" fill="#ef4444" radius={[3, 3, 0, 0]} name="Contactos" />
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
            Distribución de Contacto
          </div>
          <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 12 }}>
            {ops.total_records || 0} llamadas totales
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {(contactDist.buckets || []).map((bucket, i) => {
              const pct = parseFloat(bucket.pct || bucket.percentage || 0);
              return (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                    <span style={{ color: 'var(--text-muted)' }}>{bucket.label || bucket.range || `Bucket ${i + 1}`}</span>
                    <span style={{ color: 'var(--text-main)' }}>{pct}%</span>
                  </div>
                  <div className="progress-bar-track">
                    <motion.div
                      className="progress-bar-fill"
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ delay: 0.3 + i * 0.05, duration: 0.6 }}
                      style={{ background: i < 4 ? 'var(--green)' : i < 6 ? 'var(--amber)' : 'var(--red)' }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {contactDist.overcontact_pct && (
            <div style={{ marginTop: 16, fontSize: 12, fontWeight: 700, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>⚠️</span>
              <span>{contactDist.overcontact_pct}% de llamadas exceden el sweet spot</span>
            </div>
          )}
        </motion.div>
      </div>
    </>
  );
}
