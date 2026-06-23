/**
 * Little's Law y métricas de cola desde agregados del payload (sin BD).
 */

function round(val, decimals = 2) {
    if (val == null || !Number.isFinite(val)) return null;
    const factor = Math.pow(10, decimals);
    return Math.round(val * factor) / factor;
}

function resolveServiceMinutes(callMetrics) {
    const avg = Number(callMetrics?.call_duration?.avg);
    if (!Number.isFinite(avg) || avg <= 0) return 3;

    if (avg > 50000) return avg / 60000;
    if (avg > 180) return avg / 60;
    return avg;
}

function enrichLittlesLaw(data) {
    if (!data || typeof data !== 'object') return data;

    const ops = data.operations || {};
    const cfg = data.meta?.config || {};
    const forecast = data.forecast || {};
    const rf = data.forecast_rf || {};

    const avgDaily = Number(ops.avg_daily);
    if (!Number.isFinite(avgDaily) || avgDaily <= 0) {
        ops.littles_law = { available: false, reason: 'missing_avg_daily' };
        data.operations = ops;
        return data;
    }

    const existing = ops.littles_law;
    if (existing?.available === true && existing.arrival_rate_per_hour > 0) {
        return data;
    }

    const maxCapacity = Number(cfg.max_system_capacity) || 4000;
    const callMetrics = ops.call_metrics || {};

    let forecastValue = Number(forecast.recommended_value);
    if (!Number.isFinite(forecastValue) || forecastValue <= 0) {
        if (rf.available !== false && rf.recommended_value != null) {
            forecastValue = Number(rf.recommended_value);
        }
    }
    if (!Number.isFinite(forecastValue) || forecastValue <= 0) {
        forecastValue = avgDaily;
    }

    const arrivalRatePerHour = avgDaily / 24;
    const serviceMinutes = resolveServiceMinutes(callMetrics);
    const serviceHours = serviceMinutes / 60;
    const estimatedQueue = arrivalRatePerHour * serviceHours;
    const utilizationPct = maxCapacity > 0 ? (forecastValue / maxCapacity) * 100 : null;

    const forecastRatio = avgDaily > 0 ? forecastValue / avgDaily : 1;
    let staffingPressure = 'ok';
    let staffingGapTomorrow = 0;

    if (forecastRatio >= 1.25 || (utilizationPct != null && utilizationPct >= 90)) {
        staffingPressure = 'critical';
        staffingGapTomorrow = Math.max(0, Math.round(forecastValue - avgDaily * 1.1));
    } else if (forecastRatio >= 1.1 || (utilizationPct != null && utilizationPct >= 75)) {
        staffingPressure = 'pressure';
        staffingGapTomorrow = Math.max(0, Math.round(forecastValue - avgDaily));
    }

    ops.littles_law = {
        available: true,
        arrival_rate_per_hour: round(arrivalRatePerHour, 2),
        avg_service_minutes: round(serviceMinutes, 2),
        estimated_queue_leads: round(estimatedQueue, 1),
        utilization_pct: utilizationPct != null ? round(utilizationPct, 1) : null,
        capacity_leads_per_day: maxCapacity,
        staffing_pressure: staffingPressure,
        staffing_gap_tomorrow: staffingGapTomorrow,
        forecast_value: Math.round(forecastValue),
        forecast_ratio: round(forecastRatio, 3),
    };

    data.operations = ops;
    return data;
}

module.exports = {
    enrichLittlesLaw,
    resolveServiceMinutes,
};
