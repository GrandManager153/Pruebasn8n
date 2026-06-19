import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import useDashboardStore from '../stores/useDashboardStore';
import KpiCard from '../components/shared/KpiCard';
import KpiModal from '../components/shared/KpiModal';

const INTERVAL_CALLBACK_SLA_MIN = 24 * 60;

function formatDurationPair(actualMin, thresholdMin, decimals = 1) {
  const actual = Number(actualMin);
  const threshold = Number(thresholdMin);
  if (!Number.isFinite(actual) || actual < 0) {
    return { actual: { text: '—' }, threshold: { text: '—' } };
  }
  const scale = Math.max(actual, Number.isFinite(threshold) ? threshold : 0, 0);

  if (scale >= 2880) {
    const fmt = (m) => {
      const days = (m / 1440).toFixed(decimals);
      const label = Number(days) === 1 ? 'día' : 'días';
      return `${days} ${label}`;
    };
    return {
      actual: { text: fmt(actual) },
      threshold: { text: Number.isFinite(threshold) ? fmt(threshold) : '—' },
    };
  }
  if (scale >= 120) {
    const fmt = (m) => `${(m / 60).toFixed(decimals)} h`;
    return {
      actual: { text: fmt(actual) },
      threshold: { text: Number.isFinite(threshold) ? fmt(threshold) : '—' },
    };
  }
  const fmt = (m) => `${Math.round(m)} min`;
  return {
    actual: { text: fmt(actual) },
    threshold: { text: Number.isFinite(threshold) ? fmt(threshold) : '—' },
  };
}

function formatAlertThreshold(threshold, alert) {
  if (alert?.threshold_display) return alert.threshold_display;
  if (threshold == null || threshold === 0) return 'N/A';
  if (isIntervalMinutesMetric(alert)) {
    return formatDurationPair(alert.actual, threshold).threshold.text;
  }
  return threshold;
}

function isIntervalMinutesMetric(alert) {
  return alert?.metric === 'avg_interval_min';
}

function formatObservedValue(alert) {
  if (alert?.actual_display) return alert.actual_display;
  const val = alert.actual ?? alert.observed_value ?? alert.value;
  if (val === undefined || val === null || val === '') return '—';
  if (isIntervalMinutesMetric(alert)) {
    return formatDurationPair(alert.actual, alert.threshold ?? INTERVAL_CALLBACK_SLA_MIN).actual.text;
  }
  return val;
}

function formatAlertTitle(alert) {
  return alert.title || alert.message || alert.alert || '—';
}

function normalizeOperationalAlerts(data) {
  const alerts = data?.system?.alerts;
  if (!Array.isArray(alerts)) return data;

  const intervalAlert = alerts.find((a) => a.metric === 'avg_interval_min');
  if (!intervalAlert) return data;

  const actualMin = Number(intervalAlert.actual) || 0;
  const pair = formatDurationPair(actualMin, INTERVAL_CALLBACK_SLA_MIN);
  const ratio = actualMin / INTERVAL_CALLBACK_SLA_MIN;

  intervalAlert.threshold = INTERVAL_CALLBACK_SLA_MIN;
  intervalAlert.actual_display = pair.actual.text;
  intervalAlert.threshold_display = pair.threshold.text;
  intervalAlert.title = `Demora media entre re-intentos: ${pair.actual.text} (objetivo: ≤${pair.threshold.text})`;
  intervalAlert.impact = `Entre una marcación y la siguiente, los leads esperan ${pair.actual.text} en promedio (${ratio.toFixed(1)}× el objetivo de ${pair.threshold.text}). Esto incluye pausas largas y leads reactivados días después.`;

  if (ratio >= 2.5 && intervalAlert.severity === 'warning') {
    intervalAlert.severity = 'critical';
  }

  return data;
}

export default function AlertsPage() {
  const { data, loading } = useDashboardStore();
  const [filter, setFilter] = useState('all');
  const [modal, setModal] = useState({ open: false, label: '', value: '' });

  if (loading || !data) {
    return (
      <div className="loading-state">
        <div className="loading-spinner" />
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Cargando alertas...</p>
      </div>
    );
  }

  const alerts = normalizeOperationalAlerts(data).system?.alerts || [];
  const criticals = alerts.filter((a) => a.severity === 'critical').length;
  const warnings = alerts.filter((a) => a.severity === 'warning').length;
  const infos = alerts.filter((a) => a.severity === 'info').length;
  const maxRPN = Math.max(...alerts.map((a) => a.rpn_score || a.rpn || 0), 0);

  const filtered = useMemo(() => {
    const list = filter === 'all'
      ? alerts
      : alerts.filter((a) => a.severity === filter);
    return [...list].sort((a, b) => (b.rpn_score || b.rpn || 0) - (a.rpn_score || a.rpn || 0));
  }, [alerts, filter]);

  const severityBadge = (s) => {
    const map = {
      critical: { cls: 'badge-danger', label: 'Crítica' },
      warning: { cls: 'badge-warning', label: 'Advertencia' },
      info: { cls: 'badge-info', label: 'Info' },
    };
    const badge = map[s] || map.info;
    return <span className={`badge ${badge.cls}`}>{badge.label}</span>;
  };

  return (
    <>
      {/* Stats Cards */}
      <div className="grid-4">
        <KpiCard
          label="Total Alerts (Alertas Totales)"
          value={alerts.length}
          color="gold"
          delay={0}
          onClick={() => setModal({ open: true, label: 'Total Alerts (Alertas Totales)', value: String(alerts.length) })}
        />
        <KpiCard
          label="Critical Alerts (Alertas Críticas)"
          value={criticals}
          color="red"
          delay={0.04}
          onClick={() => setModal({ open: true, label: 'Critical Alerts (Alertas Críticas)', value: String(criticals) })}
        />
        <KpiCard
          label="Max Severity (Severidad Máxima)"
          value={maxRPN}
          sub="RPN Score"
          color="red"
          delay={0.08}
          onClick={() => setModal({ open: true, label: 'Max Severity (Severidad Máxima)', value: String(maxRPN) })}
        />
        <KpiCard
          label="Warnings & Info (Advertencias e Info)"
          value={warnings + infos}
          color="blue"
          delay={0.12}
          onClick={() => setModal({ open: true, label: 'Warnings & Info (Advertencias e Info)', value: String(warnings + infos) })}
        />
      </div>

      {/* Alerts Table */}
      <motion.div
        className="card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        style={{ marginTop: 'var(--gap-bento)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div className="section-title">
            <span className="bar" />
            Incident Box (Buzón de Incidentes y Anomalías)
          </div>
          <div className="filter-pills">
            {['all', 'critical', 'warning', 'info'].map((f) => (
              <button
                key={f}
                className={`filter-pill ${f !== 'all' ? f : ''} ${filter === f ? 'active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? 'Todas' : f === 'critical' ? 'Críticas' : f === 'warning' ? 'Advertencias' : 'Informativas'}
              </button>
            ))}
          </div>
        </div>

        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
          Supervisión en tiempo real de desviaciones operativas, reintentos de contacto y anomalías de inversión.
        </p>

        <div className="custom-table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Gravedad</th>
                <th>Alerta de Sistema</th>
                <th style={{ textAlign: 'right' }}>Valor Observado</th>
                <th style={{ textAlign: 'right' }}>Umbral Tolerado</th>
                <th>RPN</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? (
                filtered.map((alert, i) => (
                  <motion.tr
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <td>{severityBadge(alert.severity)}</td>
                    <td style={{ fontWeight: 600 }}>{formatAlertTitle(alert)}</td>
                    <td style={{ textAlign: 'right' }}>{formatObservedValue(alert)}</td>
                    <td style={{ textAlign: 'right' }}>{formatAlertThreshold(alert.threshold, alert)}</td>
                    <td>
                      <span style={{
                        color: (alert.rpn_score || alert.rpn || 0) > 400 ? 'var(--red)' : 'var(--amber)',
                        fontWeight: 700
                      }}>
                        {alert.rpn_score || alert.rpn || '—'}
                      </span>
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
