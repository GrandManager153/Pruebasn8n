/**
 * Normaliza alertas operativas cuyo copy/unidades confunden en el dashboard.
 * Ej.: intervalo entre re-intentos (promedio con pausas largas) vs umbral de 60 min.
 */

const INTERVAL_CALLBACK_SLA_MIN = 24 * 60; // 24 h — objetivo operativo entre re-intentos

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

function formatDurationMinutes(totalMinutes, decimals = 1) {
    return formatDurationPair(totalMinutes, totalMinutes, decimals).actual;
}

function enrichIntervalAlerts(data) {
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

    const actions = data?.system?.actions;
    if (Array.isArray(actions)) {
        actions.forEach((action) => {
            const copy = `${action.action || ''} ${action.evidence || ''} ${action.reason || ''}`;
            if (!/intervalo entre intentos|intervalo alto|minutes_since_prev|re-intentos/i.test(copy)) return;
            action.action = `Reducir demora entre re-intentos de contacto (actual: ${pair.actual.text} de promedio)`;
            action.reason = `Demora media ${pair.actual.text} supera el objetivo operativo de ${pair.threshold.text}`;
            action.evidence = `Promedio observado: ${pair.actual.text}; objetivo: ≤${pair.threshold.text}`;
        });
    }

    return data;
}

function enrichOperationalAlerts(data) {
    if (!data || typeof data !== 'object') return data;
    enrichIntervalAlerts(data);
    return data;
}

module.exports = {
    INTERVAL_CALLBACK_SLA_MIN,
    formatDurationMinutes,
    formatDurationPair,
    enrichOperationalAlerts,
};
