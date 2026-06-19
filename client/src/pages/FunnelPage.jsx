import { useState } from 'react';
import { motion } from 'framer-motion';
import useDashboardStore from '../stores/useDashboardStore';
import KpiCard from '../components/shared/KpiCard';
import KpiModal from '../components/shared/KpiModal';

const FUNNEL_PREVIEW_COUNT = 3;

const STATIC_PROBABILITIES = [
  { state: "Abierto", conversion: 2.14, loss: 97.86, steps: 14.2, stddev: 4.5 },
  { state: "Conectado - Interesado", conversion: 35.24, loss: 64.76, steps: 5.4, stddev: 1.8 },
  { state: "Reactivación", conversion: 20.00, loss: 80.00, steps: 7.2, stddev: 2.1 },
  { state: "En Llamada", conversion: 14.15, loss: 85.85, steps: 8.9, stddev: 3.2 },
  { state: "Pre-Cerrado (Sin tarjeta)", conversion: 13.01, loss: 86.99, steps: 11.5, stddev: 3.9 }
];

const CRM_TRANSLATIONS = {
  'PreClosed – Cash Only': 'Pre-Cierre (Solo Efectivo)',
  'PreClosed - Cash Only': 'Pre-Cierre (Solo Efectivo)',
  'PreClosed Cash Only': 'Pre-Cierre (Solo Efectivo)',
  'PreClosed Reactivación': 'Pre-Cierre (Reactivación)',
  'PreClosed Reactivacin': 'Pre-Cierre (Reactivación)',
  'PreClosed - No Card': 'Pre-Cierre (Sin Tarjeta)',
  'PreClosed - No Answer': 'Pre-Cierre (Sin Respuesta)',
  'PreClosed - Busy': 'Pre-Cierre (Ocupado)',
  'PreClosed - Hung Up': 'Pre-Cierre (Llamada Colgada)',
  'PreClosed - Distrust': 'Pre-Cierre (Desconfianza)',
  'PreClosed - Indirect Client': 'Pre-Cierre (Cliente Indirecto)',
  'PreClosed - Needs to be Approved': 'Pre-Cierre (Pendiente Aprobación)',
  'PreClosed - No Money - No Job': 'Pre-Cierre (Sin Dinero/Trabajo)',
  'PreClosed - No Price': 'Pre-Cierre (Sin Dinero/Trabajo)',
  'PreClosed - Prefers to go to the office': 'Pre-Cierre (Prefiere Oficina)',
  'PreClosed Opportunity': 'Oportunidad de Pre-Cierre',
  'Pre-Cerrado (Sin tarjeta)': 'Pre-Cierre (Sin Tarjeta)',
  'Abierto (Open)': 'Abierto',
  'Busy - Callback': 'Ocupado (Re-llamada)',
  'Connected Voicemail': 'Buzón de Voz',
  'EN LLAMADA': 'En Llamada',
  'New Lead': 'Nuevo Lead',
  'No Answer': 'Sin Respuesta',
  'New Lead Primer Intento': 'Nuevo Lead - 1er Intento',
  'Alivio Vendido': 'Alivio Vendido',
  'Cita en oficina': 'Cita en Oficina',
  'Connected - Not Interested': 'Contactado (No Interesado)',
  'Consult Booked': 'Consulta Agendada',
  'Consult Booked PROMO': 'Consulta Agendada (Promo)',
  'Customer Service Call': 'Llamada Atención Cliente',
  'Detenidos - Cortes': 'Detenidos / Cortes',
  'Duplicate Lead': 'Lead Duplicado',
  'Hung Up': 'Llamada Colgada',
  'Indirect Client': 'Cliente Indirecto',
  'Leads Opportunity': 'Oportunidad de Lead',
  'OutReach Primer Intento': 'Contacto - 1er Intento',
  'OutReach Segundo Intento': 'Contacto - 2do Intento',
  'Pre Closed PROMO': 'Pre-Cierre (Promo)',
  'Reconversion Lead': 'Reconversión de Lead',
  'Recovery Department': 'Dpto. de Recuperación',
  'Recovery No Answer': 'Recuperación - Sin Respuesta',
  'Transfer to Detenidos': 'Transferido a Detenidos',
  'Wrong Number': 'Número Equivocado',
  'Consult Booked HS': 'Consulta Agendada (HS)',
  'NL Agendado CDMX': 'Lead Agendado CDMX',
  'Consult Booked - Referal to Detainees': 'Consulta Agendada (Ref. Detenidos)',
  'Hot Transfer Cancn': 'Transferencia Directa Cancún',
  'NL Connector CUN': 'Conector Lead Nuevo CUN',
  'New Lead Segundo Intento': 'Nuevo Lead - 2do Intento',
  'Outeach 3 intento': 'Contacto - 3er Intento',
  'Recovery Not Interested': 'Recuperación - No Interesado',
  'NL Agendado CUN': 'Lead Agendado CUN'
};

const FUNNEL_SHORT_LABELS = {
  'Contactado (No Interesado)': 'No interesado',
  'Sin Respuesta': 'Sin respuesta',
  'Llamada Colgada': 'Colgó',
  'Número Equivocado': 'Núm. equivocado',
  'Buzón de Voz': 'Buzón de voz',
  'Ocupado (Re-llamada)': 'Ocupado',
  'Pre-Cierre (Sin Respuesta)': 'Pre-cierre sin resp.',
  'Pre-Cierre (Llamada Colgada)': 'Pre-cierre colgó',
  'Pre-Cierre (Desconfianza)': 'Desconfianza',
  'Pre-Cierre (Ocupado)': 'Pre-cierre ocupado',
  'Pre-Cierre (Sin Tarjeta)': 'Pre-cierre sin tarjeta',
  'Pre-Cierre (Solo Efectivo)': 'Pre-cierre efectivo',
  'Pre-Cierre (Cliente Indirecto)': 'Cliente indirecto',
  'Pre-Cierre (Sin Dinero/Trabajo)': 'Sin dinero/trabajo',
  'Pre-Cierre (Prefiere Oficina)': 'Prefiere oficina',
  'Pre-Cierre (Reactivación)': 'Pre-cierre reactivación',
  'Pre-Cierre (Promo)': 'Pre-cierre promo',
  'Pre-Cierre (Pendiente Aprobación)': 'Pendiente aprobación',
  'Recuperación - Sin Respuesta': 'Recup. sin respuesta',
  'Recuperación - No Interesado': 'Recup. no interesado',
  'Nuevo Lead - 1er Intento': 'Lead nuevo (1.er)',
  'Nuevo Lead - 2do Intento': 'Lead nuevo (2.do)',
  'Contacto - 1er Intento': '1.er contacto',
  'Contacto - 2do Intento': '2.do contacto',
  'Contacto - 3er Intento': '3.er contacto',
  'En Llamada': 'En llamada',
  'Consulta Agendada': 'Cita agendada',
  'Consulta Agendada (Promo)': 'Cita promo',
  'Dpto. de Recuperación': 'Recuperación',
  'Transferido a Detenidos': 'A detenidos',
  'Lead Duplicado': 'Duplicado',
  'Llamada Atención Cliente': 'Atención cliente',
  'Detenidos / Cortes': 'Detenidos',
  'Oportunidad de Lead': 'Oportunidad',
  'Oportunidad de Pre-Cierre': 'Oport. pre-cierre',
  'Reconversión de Lead': 'Reconversión',
  'Lead Agendado CDMX': 'Agendado CDMX',
  'Lead Agendado CUN': 'Agendado CUN',
  'Nuevo Lead': 'Lead nuevo',
  'Abierto': 'Abierto',
};

function shortenFunnelLabel(name) {
  const cleaned = (name || '—').trim();
  if (FUNNEL_SHORT_LABELS[cleaned]) return FUNNEL_SHORT_LABELS[cleaned];

  const preClosed = cleaned.match(/^Pre-Cierre \((.+)\)$/i);
  if (preClosed) return preClosed[1];

  const contacted = cleaned.match(/^Contactado \((.+)\)$/i);
  if (contacted) return contacted[1];

  if (cleaned.length > 34) return `${cleaned.slice(0, 32)}…`;
  return cleaned;
}

function formatLeakDisplay(from, to) {
  const sourceFull = cleanStateName(from || 'Origen');
  const targetFull = cleanStateName(to || 'Destino');
  return {
    title: shortenFunnelLabel(targetFull),
    subtitle: `Origen: ${shortenFunnelLabel(sourceFull)}`,
    sourceFull,
    targetFull,
  };
}

function cleanStateName(name) {
  if (!name) return '—';
  const trimmed = name.trim();
  if (CRM_TRANSLATIONS[trimmed]) return CRM_TRANSLATIONS[trimmed];

  let result = trimmed;
  for (const [key, val] of Object.entries(CRM_TRANSLATIONS)) {
    const escapedKey = key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(escapedKey, 'gi');
    result = result.replace(regex, val);
  }
  return result;
}

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

function mapProbabilityRow(p) {
  return {
    state: cleanStateName(p.state),
    conversion: (p.prob_conversion || 0) * 100,
    loss: (p.prob_loss || 0) * 100,
    steps: p.expected_steps || 0,
    stddev: p.step_stddev || 0,
  };
}

function parseFeederFromAlert(alert) {
  const titleStr = (alert.title || '').replace('Feeder a conversion: ', '');
  const parts = titleStr.split(' aporta ');
  const state = cleanStateName(parts[0] || 'Origen');
  const metricsStr = parts[1] || '0%';
  const pct = parseFloat(metricsStr.split('%')[0]) || alert.actual || 0;
  const leadMatch = titleStr.match(/\((\d+)\s*leads?\)/i);
  const cnt = leadMatch ? parseInt(leadMatch[1], 10) : 0;
  return { from: state, pct, cnt };
}

function isLeakDestination(to) {
  const t = String(to || '').toLowerCase();
  return t.includes('not interested')
    || t.includes('no answer')
    || t.includes('hung up')
    || t.includes('wrong number')
    || t.includes('busy')
    || t.includes('lost')
    || t.includes('voicemail')
    || t.includes('distrust');
}

function resolveFunnelFeeders(funnel, alerts) {
  const feeders = funnel?.feeders;
  if (Array.isArray(feeders) && feeders.length) {
    return feeders
      .map((f) => ({
        from: f.from || f.state || 'Origen',
        pct: Number(f.pct) || 0,
        cnt: Number(f.cnt) || 0,
      }))
      .sort((a, b) => b.pct - a.pct);
  }
  return (alerts || [])
    .filter((a) => a.title?.includes('Feeder a conversion'))
    .map(parseFeederFromAlert);
}

function resolveFunnelLeaks(transitions) {
  return (transitions || [])
    .filter((t) => isLeakDestination(t.to))
    .map((t) => ({
      from: t.from || 'Origen',
      to: t.to || 'Destino',
      pct: Number(t.pct) || 0,
      cnt: Number(t.cnt) || 0,
    }))
    .sort((a, b) => b.pct - a.pct);
}

function resolveFunnelMarkovStates(funnel) {
  const absorption = funnel?.absorption_probabilities;
  if (Array.isArray(absorption) && absorption.length) {
    return absorption
      .map(mapProbabilityRow)
      .filter((p) => p.conversion > 0)
      .sort((a, b) => b.conversion - a.conversion);
  }
  return STATIC_PROBABILITIES;
}

function buildFunnelInsight(feeders, leaks) {
  const topFeeder = feeders[0];
  const topLeak = leaks[0];
  if (!topFeeder && !topLeak) return null;

  const parts = [];
  if (topFeeder) {
    const state = shortenFunnelLabel(cleanStateName(topFeeder.from || 'Origen'));
    const pct = Number(topFeeder.pct) || 0;
    parts.push({
      type: 'feeder',
      state,
      pct: pct.toFixed(1),
    });
  }
  if (topLeak) {
    const leak = formatLeakDisplay(topLeak.from, topLeak.to);
    const cnt = Number(topLeak.cnt) || 0;
    const pct = Number(topLeak.pct) || 0;
    parts.push({
      type: 'leak',
      title: leak.title,
      subtitle: leak.subtitle,
      cnt,
      pct: pct.toFixed(1),
    });
  }
  return parts;
}

function buildFeederModalContent(feeder) {
  const raw = feeder.from || 'Origen';
  const display = shortenFunnelLabel(cleanStateName(raw));
  const pct = Number(feeder.pct) || 0;
  const cnt = Number(feeder.cnt) || 0;
  return {
    label: display,
    value: `${pct.toFixed(2)}%`,
    definition: `Ruta de conversión desde "${display}". Los leads que pasan por esta etapa logran una consulta agendada.`,
    interpretation: `Participa con el ${pct.toFixed(2)}% de las conversiones del periodo, con ${cnt} consultas agendadas atribuidas a esta ruta.`,
    source: 'Mapeo de transiciones del CRM vía n8n',
  };
}

function buildLeakModalContent(leakRow) {
  const leak = formatLeakDisplay(leakRow.from, leakRow.to);
  const origin = leak.subtitle.replace('Origen: ', '');
  const pct = Number(leakRow.pct) || 0;
  const cnt = Number(leakRow.cnt) || 0;
  return {
    label: leak.title,
    subtitle: leak.subtitle,
    value: `${pct.toFixed(2)}%`,
    definition: `Punto de fuga: los leads que vienen de ${origin} acaban en ${leak.title} y abandonan el embudo.`,
    interpretation: `El ${pct.toFixed(2)}% de los leads en esta transición se pierden (${cnt} leads afectados). Conviene revisar tiempos de respuesta y calidad del contacto en ${origin}.`,
    source: 'Análisis de transición de estados del CRM',
  };
}

function FunnelListItem({ headLeft, headSub, headRight, headColor, barColor, barWidth, metaLeft, metaRight, onClick }) {
  return (
    <div
      className="funnel-list-item card-animate"
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(e); } : undefined}
    >
      <div className="funnel-list-item-head">
        <div className="funnel-list-item-title-wrap">
          <span className="funnel-list-item-title">{headLeft}</span>
          {headSub ? <span className="funnel-list-item-subtitle">{headSub}</span> : null}
        </div>
        <span className="funnel-list-item-pct" style={{ color: headColor }}>{headRight}</span>
      </div>
      <div className="funnel-list-item-bar">
        <div
          className="funnel-list-item-bar-fill"
          style={{ width: `${barWidth}%`, background: barColor }}
        />
      </div>
      <div className="funnel-list-item-meta">
        <span>{metaLeft}</span>
        <span>{metaRight}</span>
      </div>
    </div>
  );
}

function FunnelListSection({
  title,
  dotColor,
  items,
  expanded,
  onToggle,
  emptyMessage,
  expandNoun,
  renderItem,
  delay = 0,
}) {
  const visible = expanded ? items : items.slice(0, FUNNEL_PREVIEW_COUNT);
  const hasMore = items.length > FUNNEL_PREVIEW_COUNT;
  const remaining = items.length - FUNNEL_PREVIEW_COUNT;

  return (
    <motion.div
      className="card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <div className="chart-title">
        <span className="dot" style={{ background: dotColor }} />
        {title}
      </div>
      <div className={`funnel-scroll-list${expanded ? '' : ' funnel-scroll-list--preview'}`}>
        {items.length > 0 ? (
          visible.map((item, i) => renderItem(item, i))
        ) : (
          <p className="funnel-list-empty">{emptyMessage}</p>
        )}
      </div>
      {hasMore && (
        <button type="button" className="funnel-expand-btn" onClick={onToggle}>
          {expanded
            ? 'Ver menos'
            : `Ver las ${remaining} ${expandNoun} restantes`}
        </button>
      )}
    </motion.div>
  );
}

export default function FunnelPage() {
  const { data, loading } = useDashboardStore();
  const [modal, setModal] = useState({
    open: false,
    label: '',
    subtitle: '',
    value: '',
    definition: '',
    interpretation: '',
    source: '',
  });
  const [feedersExpanded, setFeedersExpanded] = useState(false);
  const [leaksExpanded, setLeaksExpanded] = useState(false);
  const [markovExpanded, setMarkovExpanded] = useState(false);
  const [markovShowAdvanced, setMarkovShowAdvanced] = useState(false);

  if (loading || !data) {
    return (
      <div className="loading-state">
        <div className="loading-spinner" />
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Cargando datos del funnel...</p>
      </div>
    );
  }

  const funnel = data.funnel || {};
  const transitions = funnel.transitions || [];

  const leadKPI = (data.kpis || []).find(k => k.label.includes('leads') || k.label.includes('Leads'));
  const totalLeads = leadKPI ? parseInt(String(leadKPI.value).replace(/[^0-9]/g, '')) : 10978;

  const consults = transitions
    .filter(t => t.to === 'Consult Booked' || t.to === 'absorption')
    .reduce((acc, curr) => acc + curr.cnt, 0) || 684;

  const conversionRate = funnel.conversion_pct != null
    ? Number(funnel.conversion_pct).toFixed(2)
    : (totalLeads > 0 ? ((consults / totalLeads) * 100).toFixed(2) : '6.23');
  const convPct = `${conversionRate}%`;

  const leaks = resolveFunnelLeaks(transitions);
  const totalLostLeads = leaks.reduce((acc, curr) => acc + curr.cnt, 0);
  const caseValue = 1200;
  const revenueAtRisk = totalLostLeads * caseValue;
  const riskRevenue = `$${revenueAtRisk.toLocaleString('es-MX')}`;

  const feeders = resolveFunnelFeeders(funnel, data.system?.alerts);
  const finalProbabilities = resolveFunnelMarkovStates(funnel);
  const insightParts = buildFunnelInsight(feeders, leaks);

  const kpiConvLabel = 'Tasa de conversión';
  const kpiRiskLabel = 'Ingreso en riesgo';

  return (
    <>
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
            ¿Cómo van las conversiones?
          </h2>
          <span className="badge badge-success">Objetivo</span>
        </div>
        <p style={{ fontSize: 13.5, color: 'var(--text-muted)', marginBottom: 20 }}>
          De cada 100 leads, <strong style={{ color: 'var(--text-main)' }}>{conversionRate}</strong> llegan a consulta.
          Hay <strong style={{ color: 'var(--text-main)' }}>{riskRevenue}</strong> en riesgo por fugas detectadas.
        </p>
        <div className="grid-2">
          <KpiCard
            label={kpiConvLabel}
            value={convPct}
            color="green"
            animateValue={false}
            onClick={() => setModal({ open: true, label: kpiConvLabel, value: convPct, subtitle: '', definition: '', interpretation: '', source: '' })}
          />
          <KpiCard
            label={kpiRiskLabel}
            value={riskRevenue}
            color="red"
            animateValue={false}
            onClick={() => setModal({ open: true, label: kpiRiskLabel, value: riskRevenue, subtitle: '', definition: '', interpretation: '', source: '' })}
          />
        </div>
      </motion.div>

      {insightParts && (
        <div className="funnel-insight-banner">
          {insightParts.map((part, i) => {
            if (part.type === 'feeder') {
              return (
                <span key={i}>
                  {i > 0 ? ' ' : ''}
                  Tu mejor ruta es <strong>{part.state}</strong> ({part.pct}% de las conversiones).
                </span>
              );
            }
            return (
              <span key={i}>
                {i > 0 ? ' ' : ''}
                La fuga más relevante: <strong>{part.title}</strong> ({part.subtitle.replace('Origen: ', '')}) — {part.pct}%, {part.cnt} leads.
              </span>
            );
          })}
        </div>
      )}

      <div className="grid-2">
        <FunnelListSection
          title="De dónde vienen las conversiones"
          dotColor="var(--green)"
          items={feeders}
          expanded={feedersExpanded}
          onToggle={() => setFeedersExpanded((v) => !v)}
          emptyMessage="Sin datos de rutas disponibles"
          expandNoun="rutas"
          delay={0.1}
          renderItem={(f, i) => {
            const state = shortenFunnelLabel(cleanStateName(f.from || 'Origen'));
            const pct = typeof f.pct === 'number' ? f.pct : parseFloat(f.pct) || 0;
            const count = f.cnt || 0;
            return (
              <FunnelListItem
                key={i}
                headLeft={state}
                headRight={`${pct.toFixed(2)}%`}
                headColor="var(--green)"
                barColor="var(--green)"
                barWidth={pct}
                metaLeft="Participación en conversiones"
                metaRight={`${count} consultas agendadas`}
                onClick={() => setModal({ open: true, ...buildFeederModalContent(f) })}
              />
            );
          }}
        />

        <FunnelListSection
          title="Dónde se pierden los leads"
          dotColor="var(--red)"
          items={leaks}
          expanded={leaksExpanded}
          onToggle={() => setLeaksExpanded((v) => !v)}
          emptyMessage="Sin datos de fugas disponibles"
          expandNoun="fugas"
          delay={0.15}
          renderItem={(l, i) => {
            const leak = formatLeakDisplay(l.from, l.to);
            const pct = typeof l.pct === 'number' ? l.pct : parseFloat(l.pct) || 0;
            const count = l.cnt || 0;
            return (
              <FunnelListItem
                key={i}
                headLeft={leak.title}
                headSub={leak.subtitle}
                headRight={`${pct.toFixed(2)}%`}
                headColor="var(--crimson)"
                barColor="var(--crimson)"
                barWidth={pct}
                metaLeft="Leads afectados"
                metaRight={`${count} leads perdidos`}
                onClick={() => setModal({ open: true, ...buildLeakModalContent(l) })}
              />
            );
          }}
        />
      </div>

      <div className="funnel-accordion" style={{ marginTop: 'var(--gap-bento)' }}>
        <button
          type="button"
          className="funnel-accordion-header"
          onClick={() => setMarkovExpanded((v) => !v)}
          aria-expanded={markovExpanded}
        >
          <span className="funnel-accordion-chevron">{markovExpanded ? '▼' : '▶'}</span>
          <span>Análisis avanzado (probabilidad por estado)</span>
        </button>
        <div className={`funnel-accordion-body${markovExpanded ? ' funnel-accordion-body--open' : ''}`}>
          <div className="card" style={{ marginTop: 0 }}>
            <label className="funnel-markov-advanced-toggle">
              <input
                type="checkbox"
                checked={markovShowAdvanced}
                onChange={(e) => setMarkovShowAdvanced(e.target.checked)}
              />
              <span>Mostrar métricas avanzadas</span>
            </label>
            <div className="custom-table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Estado inicial</th>
                    <th style={{ textAlign: 'right' }}>Prob. de conversión</th>
                    {markovShowAdvanced && (
                      <>
                        <th style={{ textAlign: 'right' }}>Prob. de no convertir</th>
                        <th style={{ textAlign: 'right' }}>Toques promedio</th>
                        <th style={{ textAlign: 'right' }}>Variabilidad</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {finalProbabilities.length > 0 ? finalProbabilities.map((p, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600, color: 'white' }}>{p.state}</td>
                      <td style={{ textAlign: 'right', color: 'var(--green)', fontWeight: 'bold' }}>
                        {formatProb(p.conversion)}
                      </td>
                      {markovShowAdvanced && (
                        <>
                          <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                            {formatProb(p.loss)}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: 'white' }}>
                            {formatSteps(p.steps)}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--text-dim)' }}>
                            {p.stddev > 0 ? formatSteps(p.stddev) : '—'}
                          </td>
                        </>
                      )}
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={markovShowAdvanced ? 5 : 2} style={{ textAlign: 'center', color: 'var(--text-dim)', padding: 24 }}>
                        Sin estados con actividad de conversión en este periodo
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <KpiModal
        isOpen={modal.open}
        label={modal.label}
        subtitle={modal.subtitle}
        value={modal.value}
        definition={modal.definition || undefined}
        interpretation={modal.interpretation || undefined}
        source={modal.source || undefined}
        onClose={() => setModal({
          open: false,
          label: '',
          subtitle: '',
          value: '',
          definition: '',
          interpretation: '',
          source: '',
        })}
      />
    </>
  );
}
