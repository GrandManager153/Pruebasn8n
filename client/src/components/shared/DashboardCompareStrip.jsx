import { motion } from 'framer-motion';

const METRICS = [
  { key: 'health_score', label: 'SHS', suffix: '' },
  { key: 'total_leads', label: 'Leads', suffix: '' },
  { key: 'overcontact_pct', label: 'Sobre-contacto', suffix: '%' },
  { key: 'conversion_pct', label: 'Conversión', suffix: '%' },
  { key: 'global_cpl', label: 'CPL', prefix: '$' },
  { key: 'mase', label: 'MASE', suffix: '' },
];

function formatDelta(d, prefix = '', suffix = '') {
  if (!d || d.delta == null) return '—';
  const sign = d.delta > 0 ? '+' : '';
  const arrow = d.direction === 'up' ? '↑' : d.direction === 'down' ? '↓' : '→';
  const val = typeof d.delta === 'number'
    ? `${sign}${d.delta.toLocaleString('es-MX', { maximumFractionDigits: 2 })}`
    : d.delta;
  return `${arrow} ${prefix}${val}${suffix}`;
}

function deltaColor(d) {
  if (!d || d.direction === 'flat') return 'var(--text-muted)';
  return d.direction === 'up' ? 'var(--green)' : 'var(--red)';
}

export default function DashboardCompareStrip({ compare }) {
  if (!compare?.available) return null;

  const prevDate = compare.previous_generated_at
    ? new Date(compare.previous_generated_at).toLocaleString('es-MX', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
      })
    : '';

  return (
    <motion.div
      className="card"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ marginBottom: 16 }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: 'var(--text-muted)' }}>
        Vs ejecución anterior
        {prevDate && <span style={{ fontWeight: 500, marginLeft: 8 }}>({prevDate})</span>}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {METRICS.map((m) => {
          const d = compare.deltas?.[m.key];
          if (!d) return null;
          return (
            <div
              key={m.key}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border)',
                minWidth: 100,
              }}
            >
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>{m.label}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: deltaColor(d) }}>
                {formatDelta(d, m.prefix || '', m.suffix || '')}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
