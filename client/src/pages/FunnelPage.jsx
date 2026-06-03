import { motion } from 'framer-motion';
import useDashboardStore from '../stores/useDashboardStore';
import KpiCard from '../components/shared/KpiCard';

const STATIC_PROBABILITIES = [
  { state: "Abierto", conversion: 2.14, loss: 97.86, steps: 14.2, stddev: 4.5 },
  { state: "Conectado - Interesado", conversion: 35.24, loss: 64.76, steps: 5.4, stddev: 1.8 },
  { state: "Reactivación", conversion: 20.00, loss: 80.00, steps: 7.2, stddev: 2.1 },
  { state: "En Llamada", conversion: 14.15, loss: 85.85, steps: 8.9, stddev: 3.2 },
  { state: "Pre-Cerrado (Sin tarjeta)", conversion: 13.01, loss: 86.99, steps: 11.5, stddev: 3.9 }
];

function formatProb(val) {
  if (typeof val === 'number') {
    const v = val <= 1 ? val * 100 : val;
    return `${v.toFixed(2)}%`;
  }
  if (typeof val === 'string' && val) {
    if (!val.includes('%') && !isNaN(parseFloat(val))) {
      const parsed = parseFloat(val);
      const v = parsed <= 1 ? parsed * 100 : parsed;
      return `${v.toFixed(2)}%`;
    }
    return val;
  }
  return '—';
}

function formatSteps(val) {
  if (typeof val === 'number') {
    return val.toFixed(1);
  }
  return val || '—';
}

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

  const displayProbabilities = probabilities.length > 0 
    ? probabilities.map(p => ({
        state: p.state || p.status || p.label || '—',
        conversion: p.conversion_prob !== undefined ? p.conversion_prob : (p.probability !== undefined ? p.probability : 0),
        loss: p.prob_loss !== undefined ? p.prob_loss : (p.loss !== undefined ? p.loss : 0),
        steps: p.expected_steps !== undefined ? p.expected_steps : (p.steps !== undefined ? p.steps : 0),
        stddev: p.step_stddev !== undefined ? p.step_stddev : (p.stddev !== undefined ? p.stddev : 0)
      }))
    : STATIC_PROBABILITIES;

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
      <div style={{ marginTop: 'var(--gap-bento)' }}>
        <div className="section-header">
          <div className="section-title">
            <span className="bar" />
            Probabilidades de Conversión y Pasos Operativos Esperados
          </div>
        </div>
        <motion.div className="card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="custom-table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Estado Inicial del Lead</th>
                  <th style={{ textAlign: 'right' }}>Probabilidad de Conversión</th>
                  <th style={{ textAlign: 'right' }}>Probabilidad de Cierre Defectuoso</th>
                  <th style={{ textAlign: 'right' }}>Pasos Esperados</th>
                  <th style={{ textAlign: 'right' }}>Desviación Estándar de Pasos</th>
                </tr>
              </thead>
              <tbody>
                {displayProbabilities.map((p, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600, color: 'white' }}>{p.state}</td>
                    <td style={{ textAlign: 'right', color: 'var(--green)', fontWeight: 'bold' }}>
                      {formatProb(p.conversion)}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                      {formatProb(p.loss)}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: 'white' }}>
                      {formatSteps(p.steps)}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--text-dim)' }}>
                      {formatSteps(p.stddev)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </>
  );
}
