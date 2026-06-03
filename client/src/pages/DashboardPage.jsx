import { useState } from 'react';
import { motion } from 'framer-motion';
import useDashboardStore from '../../stores/useDashboardStore';
import KpiCard from '../shared/KpiCard';
import KpiModal from '../shared/KpiModal';
import HealthHero from '../shared/HealthHero';

export default function DashboardPage() {
  const { data, loading } = useDashboardStore();
  const [modal, setModal] = useState({ open: false, label: '', value: '' });

  if (loading || !data) {
    return (
      <div className="loading-state">
        <div className="loading-spinner" />
        <p style={{ color: 'var(--text-muted)', fontSize: 14, fontWeight: 500 }}>
          Cargando datos analíticos del BOS...
        </p>
      </div>
    );
  }

  const sys = data.system || {};
  const ops = data.operations || {};
  const forecast = data.forecast || {};
  const investment = data.investment || {};

  const kpis = [
    {
      label: 'Total Leads (volumen total)',
      value: ops.total_leads || 0,
      sub: `Periodo de ${ops.total_days || 0} días`,
      color: 'blue',
      key: 'Leads totales',
    },
    {
      label: 'Daily Avg (promedio diario)',
      value: ops.avg_daily || 0,
      sub: 'Leads por día',
      color: 'green',
      key: 'Promedio diario',
    },
    {
      label: 'WoW (cambio semanal)',
      value: ops.wow_change_pct || '0%',
      sub: 'vs semana anterior',
      color: (ops.wow_change_pct || '').includes('-') ? 'red' : 'green',
      key: 'Cambio semanal',
      animateValue: false,
    },
    {
      label: 'Peak Hour (hora pico)',
      value: ops.peak_hour || '--',
      sub: 'Hora de máxima actividad',
      color: 'gold',
      key: 'Hora pico',
      animateValue: false,
    },
    {
      label: 'Daily Forecast (pronóstico)',
      value: forecast.recommended_value || 0,
      sub: `Modelo: ${forecast.recommended_model || 'N/A'}`,
      color: 'blue',
      key: 'Prevision diaria',
    },
    {
      label: 'MASE (precisión modelo)',
      value: forecast.diagnostics?.best_mase || 0,
      sub: parseFloat(forecast.diagnostics?.best_mase) < 1 ? 'Supera línea base' : 'No supera línea base',
      color: parseFloat(forecast.diagnostics?.best_mase) < 1 ? 'green' : 'red',
      key: 'MASE',
      decimals: 2,
    },
    {
      label: 'CPL (costo por lead)',
      value: investment?.cpl?.global_cpl || 0,
      sub: 'Costo implícito por prospecto',
      color: 'gold',
      key: 'CPL implicito',
      prefix: '$',
      decimals: 2,
    },
    {
      label: 'Ad Spend (gasto en pauta)',
      value: investment?.total_spend || 0,
      sub: 'Inversión ejecutada en el periodo',
      color: 'blue',
      key: 'Gasto total',
      prefix: '$',
    },
  ];

  const actions = (data.system?.actions || []).slice(0, 3);

  return (
    <>
      {/* Health Hero */}
      <HealthHero
        score={sys.health_score || 0}
        reasons={sys.health_reason || sys.health_reasons || ''}
      />

      {/* KPIs */}
      <div className="section-header">
        <div className="section-title">
          <span className="bar" />
          Indicadores Clave de Rendimiento
        </div>
      </div>
      <div className="grid-4">
        {kpis.map((kpi, i) => (
          <KpiCard
            key={kpi.key}
            label={kpi.label}
            value={kpi.value}
            sub={kpi.sub}
            color={kpi.color}
            delay={i * 0.04}
            prefix={kpi.prefix}
            suffix={kpi.suffix}
            decimals={kpi.decimals}
            animateValue={kpi.animateValue !== false}
            onClick={() =>
              setModal({ open: true, label: kpi.key, value: String(kpi.value) })
            }
          />
        ))}
      </div>

      {/* Actions */}
      {actions.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <div className="section-header">
            <div className="section-title">
              <span className="bar" />
              Acciones Operativas Sugeridas
            </div>
          </div>
          <div className="grid-3">
            {actions.map((action, i) => (
              <motion.div
                key={i}
                className="card action-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.06 }}
              >
                <div className="action-title">{action.title || action}</div>
                {action.description && (
                  <div className="action-text">{action.description}</div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* KPI Modal */}
      <KpiModal
        isOpen={modal.open}
        label={modal.label}
        value={modal.value}
        onClose={() => setModal({ open: false, label: '', value: '' })}
      />
    </>
  );
}
