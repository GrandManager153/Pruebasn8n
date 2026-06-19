import { useState } from 'react';
import { motion } from 'framer-motion';
import useDashboardStore from '../stores/useDashboardStore';
import KpiCard from '../components/shared/KpiCard';
import KpiModal from '../components/shared/KpiModal';
import HealthHero from '../components/shared/HealthHero';

export default function DashboardPage() {
  const { data, loading } = useDashboardStore();
  const [modal, setModal] = useState({ open: false, label: '', value: '' });

  if (loading || !data) {
    return (
      <div className="loading-state">
        <div className="loading-spinner" />
        <p style={{ color: 'var(--text-muted)', fontSize: 14, fontWeight: 500 }}>
          Cargando datos analíticos de PulseMkt...
        </p>
      </div>
    );
  }

  const sys = data.system || {};
  const ops = data.operations || {};
  const forecast = data.forecast || {};
  const investment = data.investment || {};

  const rawKpis = data.kpis || [];
  const kpis = rawKpis.map((k) => {
    let label = k.label;
    let sub = k.sub || '';
    let value = k.value;
    let color = k.color || 'blue';
    let prefix = '';
    let suffix = '';
    let decimals = null;
    let animateValue = true;

    if (k.label === 'Health Score') {
      label = 'SHS (Salud Operativa Consolidada)';
      const score = parseInt(k.value) || 79;
      color = score >= 80 ? 'green' : score >= 60 ? 'gold' : 'red';
    }

    if (k.label === 'Prevision diaria') {
      let bestModelVal = 264;
      let bestModelName = 'Theta Lite';
      let bestConfidence = 'Alta';

      let maseRf = (data.forecast_rf && data.forecast_rf.mase != null) ? data.forecast_rf.mase : 999;
      let maseLocal = (data.forecast && data.forecast.mase != null) ? data.forecast.mase : 999;
      if (data.forecast && Array.isArray(data.forecast.backtest_models)) {
        data.forecast.backtest_models.forEach(m => {
          if (m.mase != null && m.mase < maseLocal) maseLocal = m.mase;
        });
      }

      if (maseRf <= maseLocal && data.forecast_rf && data.forecast_rf.recommended_value != null) {
        bestModelVal = data.forecast_rf.recommended_value;
        bestModelName = 'Random Forest';
        bestConfidence = data.forecast_rf.confidence || 'Alta';
      } else if (data.forecast && data.forecast.recommended_value != null) {
        bestModelVal = data.forecast.recommended_value;
        bestModelName = data.forecast.method || 'Theta Lite';
        bestConfidence = data.forecast.confidence || 'Alta';
      }

      let formattedName = bestModelName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      value = `~${bestModelVal}`;
      sub = `${formattedName} | ${bestConfidence.replace(/\b\w/g, c => c.toUpperCase())}`;
      label = 'Daily Forecast (Pronóstico Diario de Demanda)';
      animateValue = false;
    }

    if (k.label === 'MASE') {
      let bestModelName = 'Theta Lite';
      let bestMase = (data.forecast && data.forecast.mase != null) ? data.forecast.mase : 999;
      if (data.forecast_rf && data.forecast_rf.mase != null) {
        bestMase = data.forecast_rf.mase;
        bestModelName = 'Random Forest';
      }
      if (data.forecast && Array.isArray(data.forecast.backtest_models)) {
        data.forecast.backtest_models.forEach(m => {
          if (m.mase != null && m.mase < bestMase) {
            bestMase = m.mase;
            bestModelName = m.name;
          }
        });
      }
      let formattedName = bestModelName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      value = Number(bestMase).toFixed(2);
      sub = formattedName;
      color = 'white';
      label = 'MASE (Precisión del Modelo)';
      decimals = 2;
    }

    if (k.label === 'CPL implicito') {
      label = 'CPL (Costo por Lead Implícito)';
      sub = 'Global';
      color = 'blue';
      prefix = '$';
      decimals = 2;
    }

    if (k.label === 'Cambio regimen' || k.label === 'Cambio de Régimen') {
      label = 'Regime Shift (Cambio de Régimen)';
      color = 'blue';
    }

    if (k.label === 'Gasto total') {
      label = 'Ad Spend (Inversión Publicitaria)';
      prefix = '$';
    }

    if (k.label === 'HHI') {
      label = 'HHI (Concentración de Pauta)';
    }

    if (k.label === 'Leads totales') {
      label = 'Total Leads (Volumen Total de Leads)';
    }

    if (k.label === 'Promedio diario') {
      label = 'Daily Avg (Promedio Diario de Leads)';
    }

    if (k.label === 'Cambio semanal') {
      label = 'WoW (Cambio Semanal vs Anterior)';
    }

    if (k.label === 'Hora pico') {
      label = 'Peak Hour (Hora Pico de Contactos)';
    }

    if (k.label === 'Conversion global') {
      label = 'Global CVR (Tasa de Conversión Global)';
    }

    if (k.label === 'Revenue at Risk') {
      label = 'Revenue at Risk (Ingreso en Riesgo por Fugas)';
    }

    if (k.label === 'Prevision diaria' && !sub) {
      sub = 'estimación puntual';
    }

    // Convert values to numbers if applicable for animations
    let numVal = value;
    if (typeof value === 'string') {
      if (value.startsWith('$')) {
        prefix = '$';
        numVal = parseFloat(value.replace(/[$,]/g, '')) || 0;
      } else if (value.endsWith('%')) {
        suffix = '%';
        numVal = parseFloat(value.replace(/[%]/g, '')) || 0;
      } else if (value.startsWith('~')) {
        numVal = value;
        animateValue = false;
      } else {
        const parsed = parseFloat(value.replace(/,/g, ''));
        if (!isNaN(parsed)) {
          numVal = parsed;
        }
      }
    }

    return {
      key: k.label,
      label,
      value: numVal,
      sub,
      color,
      prefix,
      suffix,
      decimals,
      animateValue
    };
  });

  // Inject operational additional KPIs
  if (data.operations) {
    if (data.operations.latest && data.operations.latest.leads) {
      kpis.push({
        key: 'Leads Hoy',
        value: data.operations.latest.leads,
        label: 'Leads Today (Leads Recibidos Hoy)',
        sub: data.operations.latest.date || 'Último día registrado',
        color: 'blue',
        animateValue: true
      });
    }
    if (data.operations.max_daily) {
      kpis.push({
        key: 'Máximo Diario',
        value: data.operations.max_daily,
        label: 'Max Daily (Máximo Diario)',
        sub: 'Pico histórico del periodo',
        color: 'white',
        animateValue: true
      });
    }
    if (data.operations.contact_distribution && data.operations.contact_distribution.overcontact_pct != null) {
      kpis.push({
        key: 'Tasa de Sobre-Contacto',
        value: data.operations.contact_distribution.overcontact_pct,
        label: 'Overcontact Rate (Tasa de Sobre-Contacto)',
        sub: 'Llamadas > 7 intentos',
        color: 'red',
        suffix: '%',
        animateValue: true
      });
    }
    if (data.operations.call_metrics && data.operations.call_metrics.call_rank) {
      kpis.push({
        key: 'Promedio Intentos',
        value: data.operations.call_metrics.call_rank.avg,
        label: 'Avg Dial Attempts (Intentos Promedio)',
        sub: 'Marcaciones por lead (umbral: 7)',
        color: 'red',
        animateValue: true,
        decimals: 2
      });
    }
  }

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
          KPIs (Indicadores Clave de Rendimiento)
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
            onClick={() => {
              let formattedVal = String(kpi.value);
              if (typeof kpi.value === 'number') {
                formattedVal = kpi.value.toLocaleString('es-MX', {
                  minimumFractionDigits: kpi.decimals !== null && kpi.decimals !== undefined ? kpi.decimals : 0,
                  maximumFractionDigits: kpi.decimals !== null && kpi.decimals !== undefined ? kpi.decimals : 2,
                });
              }
              if (kpi.prefix) formattedVal = kpi.prefix + formattedVal;
              if (kpi.suffix) formattedVal = formattedVal + kpi.suffix;
              setModal({ open: true, label: kpi.label, value: formattedVal });
            }}
          />
        ))}
      </div>

      {/* Actions */}
      {actions.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <div className="section-header">
            <div className="section-title">
              <span className="bar" />
              Suggested Actions (Acciones Operativas Sugeridas)
            </div>
          </div>
          <div className="grid-3">
            {actions.map((action, i) => {
              const isObj = typeof action === 'object' && action !== null;
              const titleText = isObj ? action.action || action.title : action;
              const descriptionText = isObj ? action.reason || action.description : '';
              
              // Border color based on urgency
              let borderColor = 'var(--chartreuse)';
              if (isObj && action.urgency) {
                if (action.urgency === 'immediate') borderColor = 'var(--crimson)';
                else if (action.urgency === 'this_week') borderColor = 'var(--amber)';
                else if (action.urgency === 'this_month') borderColor = 'var(--blue)';
              }
              
              const metaText = isObj ? `Plazo: ${action.horizon || 'N/A'} | Resp: ${action.owner || 'N/A'}` : '';

              return (
                <motion.div
                  key={i}
                  className="card action-card"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + i * 0.06 }}
                  style={{ borderLeftColor: borderColor }}
                >
                  <div className="action-title">{titleText}</div>
                  {descriptionText && (
                    <div className="action-text">{descriptionText}</div>
                  )}
                  {metaText && (
                    <div className="action-meta" style={{ marginTop: 12, fontSize: 10.5, color: 'var(--text-dim)', fontWeight: 500 }}>
                      {metaText}
                    </div>
                  )}
                </motion.div>
              );
            })}
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
