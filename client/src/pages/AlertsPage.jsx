import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import useDashboardStore from '../stores/useDashboardStore';
import KpiCard from '../components/shared/KpiCard';

export default function AlertsPage() {
  const { data, loading } = useDashboardStore();
  const [filter, setFilter] = useState('all');

  if (loading || !data) {
    return (
      <div className="loading-state">
        <div className="loading-spinner" />
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Cargando alertas...</p>
      </div>
    );
  }

  const alerts = data.system?.alerts || [];
  const criticals = alerts.filter((a) => a.severity === 'critical').length;
  const warnings = alerts.filter((a) => a.severity === 'warning').length;
  const infos = alerts.filter((a) => a.severity === 'info').length;
  const maxRPN = Math.max(...alerts.map((a) => a.rpn_score || a.rpn || 0), 0);

  const filtered = useMemo(() => {
    if (filter === 'all') return alerts;
    return alerts.filter((a) => a.severity === filter);
  }, [alerts, filter]);

  const severityBadge = (s) => {
    const map = {
      critical: { cls: 'badge-danger', label: 'Crítica' },
      warning: { cls: 'badge-warning', label: 'Precaución' },
      info: { cls: 'badge-info', label: 'Informativa' },
    };
    const badge = map[s] || map.info;
    return <span className={`badge ${badge.cls}`}>{badge.label}</span>;
  };

  return (
    <>
      {/* Stats Cards */}
      <div className="grid-4">
        <KpiCard label="Alertas Totales" value={alerts.length} color="gold" delay={0} />
        <KpiCard label="Alertas Críticas" value={criticals} color="red" delay={0.04} />
        <KpiCard label="Severidad Máxima" value={maxRPN} sub="RPN Score" color="red" delay={0.08} />
        <KpiCard label="Advertencias e Info" value={warnings + infos} color="blue" delay={0.12} />
      </div>

      {/* Alerts Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        style={{ marginTop: 'var(--gap-bento)' }}
      >
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div className="section-title">
              <span className="bar" />
              Registro Detallado de Alertas del Sistema
            </div>
            <div className="filter-pills">
              {['all', 'critical', 'warning', 'info'].map((f) => (
                <button
                  key={f}
                  className={`filter-pill ${filter === f ? 'active' : ''}`}
                  onClick={() => setFilter(f)}
                >
                  {f === 'all' && 'Todas'}
                  {f === 'critical' && 'Críticas'}
                  {f === 'warning' && 'Advertencias'}
                  {f === 'info' && 'Info'}
                </button>
              ))}
            </div>
          </div>

          <div className="custom-table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Alerta / Componente</th>
                  <th>Severidad</th>
                  <th style={{ textAlign: 'right' }}>Valor Actual</th>
                  <th style={{ textAlign: 'right' }}>Sweet Spot</th>
                  <th style={{ textAlign: 'right' }}>RPN</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length > 0 ? (
                  filtered.map((a, i) => (
                    <motion.tr
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 + i * 0.03 }}
                    >
                      <td style={{ fontWeight: 600 }}>
                        <div style={{ color: 'white' }}>{a.title || 'Alerta'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                          {a.source ? `Módulo: ${a.source}` : ''}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${
                          a.severity === 'critical' ? 'badge-danger' : 
                          a.severity === 'warning' ? 'badge-warning' : 'badge-info'
                        }`}>
                          {a.severity === 'critical' ? 'Crítica' : 
                           a.severity === 'warning' ? 'Precaución' : 'Informativa'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 'bold', color: 'white' }}>
                        {a.actual != null ? a.actual : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--text-muted)' }}>
                        {a.threshold != null ? a.threshold : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: a.severity === 'critical' ? 'var(--red)' : 'var(--text-dim)', fontWeight: a.severity === 'critical' ? 'bold' : 'normal' }}>
                        {a.rpn_score != null ? a.rpn_score : (a.rpn != null ? a.rpn : '—')}
                      </td>
                    </motion.tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)' }}>
                      No hay alertas para este filtro
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>
    </>
  );
}
