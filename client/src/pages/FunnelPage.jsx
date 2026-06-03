import { motion } from 'framer-motion';
import useDashboardStore from '../stores/useDashboardStore';
import KpiCard from '../components/shared/KpiCard';

export default function FunnelPage() {
  const { data, loading } = useDashboardStore();

  if (loading || !data) {
    return (
      <div className="loading-state">
        <div className="loading-spinner" />
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Cargando datos del funnel...</p>
      </div>
    );
  }

  const funnel = data.funnel || {};
  const convPct = funnel.global_conversion_pct || '0%';
  const riskRevenue = funnel.total_revenue_at_risk || '$0';
  const feeders = funnel.feeders || [];
  const leaks = funnel.leaks || [];
  const probabilities = funnel.probabilities || [];

  return (
    <>
      {/* Conversion Banner */}
      <motion.div
        className="card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          background: 'linear-gradient(135deg, var(--bg-card), #0a2015)',
          borderLeft: '4px solid var(--green)',
          marginBottom: 'var(--gap-bento)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
            Desempeño y Absorción de Leads
          </h2>
          <span className="badge badge-success">Objetivo</span>
        </div>
        <p style={{ fontSize: 13.5, color: 'var(--text-muted)', marginBottom: 20 }}>
          Análisis probabilístico de la conversión general de contactos.
        </p>
        <div className="grid-2">
          <KpiCard label="Global CVR (tasa de conversión)" value={convPct} color="green" animateValue={false} />
          <KpiCard label="Revenue at Risk (ingreso en riesgo)" value={riskRevenue} color="red" animateValue={false} />
        </div>
      </motion.div>

      {/* Feeders & Leaks */}
      <div className="grid-2">
        <motion.div className="card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="chart-title">
            <span className="dot" style={{ background: 'var(--green)' }} />
            Feeders (rutas que convierten)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
            {feeders.length > 0 ? feeders.map((f, i) => (
              <div key={i} style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                {typeof f === 'string' ? f : f.label || f.name || JSON.stringify(f)}
              </div>
            )) : (
              <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>Sin datos de feeders disponibles</p>
            )}
          </div>
        </motion.div>

        <motion.div className="card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <div className="chart-title">
            <span className="dot" style={{ background: 'var(--red)' }} />
            Leaks (fugas del embudo)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
            {leaks.length > 0 ? leaks.map((l, i) => (
              <div key={i} style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                {typeof l === 'string' ? l : l.label || l.name || JSON.stringify(l)}
              </div>
            )) : (
              <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>Sin datos de leaks disponibles</p>
            )}
          </div>
        </motion.div>
      </div>

      {/* Probabilities Table */}
      {probabilities.length > 0 && (
        <div style={{ marginTop: 'var(--gap-bento)' }}>
          <div className="section-header">
            <div className="section-title">
              <span className="bar" />
              Probabilidades de Conversión
            </div>
          </div>
          <motion.div className="card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <div className="custom-table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Estado Inicial del Lead</th>
                    <th style={{ textAlign: 'right' }}>Probabilidad de Conversión</th>
                    <th style={{ textAlign: 'right' }}>Pasos Esperados</th>
                  </tr>
                </thead>
                <tbody>
                  {probabilities.map((p, i) => (
                    <tr key={i}>
                      <td>{p.state || p.status || p.label || '—'}</td>
                      <td style={{ textAlign: 'right', color: 'var(--green)' }}>
                        {p.conversion_prob || p.probability || '—'}
                      </td>
                      <td style={{ textAlign: 'right' }}>{p.expected_steps || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
}
