/**
 * Resolves forecast target date and user-facing labels (Hoy vs Mañana).
 * Target = first day after last complete observation in time_series.
 */

const TZ = 'America/Mexico_City';

function toDateKey(value) {
  if (!value) return null;
  const raw = String(value).split('T')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-CA', { timeZone: TZ });
}

function addDays(dateKey, days) {
  if (!dateKey) return null;
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function daysBetween(fromKey, toKey) {
  if (!fromKey || !toKey) return null;
  const [y1, m1, d1] = fromKey.split('-').map(Number);
  const [y2, m2, d2] = toKey.split('-').map(Number);
  const a = Date.UTC(y1, m1 - 1, d1);
  const b = Date.UTC(y2, m2 - 1, d2);
  return Math.round((b - a) / 86400000);
}

function formatShortEs(dateKey) {
  if (!dateKey) return '';
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
}

function resolveTimeSeries(payload) {
  const rf = payload?.forecast_rf;
  const f = payload?.forecast;
  if (rf?.time_series?.length) return rf.time_series;
  if (f?.time_series?.length) return f.time_series;
  return [];
}

function resolveForecastTarget(payload, options = {}) {
  const referenceDate = toDateKey(
    options.referenceDate || payload?.meta?.generated_at || new Date().toISOString()
  );
  const ts = resolveTimeSeries(payload);
  const lastCompleteDate = ts.length
    ? toDateKey(ts[ts.length - 1].date)
    : toDateKey(payload?.operations?.latest?.date);

  let targetDate = toDateKey(
    payload?.forecast?.next_point?.date
      || payload?.forecast_rf?.next_point?.date
      || payload?.forecast?.forecast_target?.target_date
      || payload?.forecast_rf?.forecast_target?.target_date
  );
  if (!targetDate && lastCompleteDate) {
    targetDate = addDays(lastCompleteDate, 1);
  }

  const horizonOffset = targetDate && referenceDate != null
    ? daysBetween(referenceDate, targetDate)
    : 1;

  let labelShort = 'Mañana';
  let labelCard = 'Pronóstico de mañana';
  let labelKpi = 'Pronóstico de Mañana';
  let explanationEs = 'Predicción de leads para el día siguiente al último dato completo en la serie.';

  if (horizonOffset === 0) {
    labelShort = 'Hoy';
    labelCard = 'Pronóstico de hoy';
    labelKpi = 'Pronóstico de Hoy';
    explanationEs = 'Predicción de leads para hoy, usando datos completos hasta el último día cerrado en la serie.';
  } else if (horizonOffset === 1) {
    labelShort = 'Mañana';
    labelCard = 'Pronóstico de mañana';
    labelKpi = 'Pronóstico de Mañana';
    explanationEs = 'Predicción de leads para mañana, usando datos completos hasta el último día cerrado en la serie.';
  } else if (targetDate) {
    const fmt = formatShortEs(targetDate);
    labelShort = fmt;
    labelCard = `Pronóstico ${fmt}`;
    labelKpi = `Pronóstico ${fmt}`;
    explanationEs = `Predicción de leads para el ${fmt}, usando datos completos hasta el último día cerrado en la serie.`;
  }

  const lastFmt = lastCompleteDate ? formatShortEs(lastCompleteDate) : null;
  const subtext = lastFmt
    ? `Basado en datos completos hasta el ${lastFmt}`
    : 'Basado en el último día completo de la serie';

  return {
    last_complete_date: lastCompleteDate,
    target_date: targetDate,
    reference_date: referenceDate,
    horizon_offset: horizonOffset,
    label_short: labelShort,
    label_card: labelCard,
    label_kpi: labelKpi,
    label_chart: targetDate ? formatShortEs(targetDate) : labelShort,
    subtext,
    explanation_es: explanationEs,
    timezone: TZ,
  };
}

function attachForecastTarget(payload, options = {}) {
  if (!payload) return payload;
  const target = resolveForecastTarget(payload, options);
  if (payload.forecast) payload.forecast.forecast_target = target;
  if (payload.forecast_rf) {
    payload.forecast_rf.forecast_target = { ...target };
  }
  return payload;
}

module.exports = {
  TZ,
  toDateKey,
  addDays,
  daysBetween,
  formatShortEs,
  resolveForecastTarget,
  attachForecastTarget,
  resolveTimeSeries,
};
