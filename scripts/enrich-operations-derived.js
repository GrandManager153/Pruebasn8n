/**
 * KPIs operativos y economics derivados del payload existente (sin BD).
 */

const { isConversionState } = require('./markov-matrix');

function safeDiv(num, den) {
    const n = Number(num);
    const d = Number(den);
    if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return null;
    return n / d;
}

function round(val, decimals = 4) {
    if (val == null || !Number.isFinite(val)) return null;
    const factor = Math.pow(10, decimals);
    return Math.round(val * factor) / factor;
}

function resolveEconomicsConfig(data) {
    const cfg = data?.meta?.config || {};
    return {
        revenue_per_conversion: Number(cfg.revenue_per_conversion) || 1200,
        conversion_target: data?.funnel?.conversion_target || cfg.conversion_target || 'Consult Booked',
    };
}

function countConversions(data, conversionTarget) {
    const transitions = data?.funnel?.transitions || [];
    return transitions
        .filter((t) => isConversionState(t.to, conversionTarget))
        .reduce((sum, t) => sum + (Number(t.cnt) || 0), 0);
}

function buildForecastVsCapacity(data) {
    const ops = data?.operations || {};
    const forecast = data?.forecast || {};
    const rf = data?.forecast_rf || {};

    let recommended = Number(forecast.recommended_value);
    if ((!Number.isFinite(recommended) || recommended <= 0) && rf.available !== false) {
        recommended = Number(rf.recommended_value);
    }

    const avgDaily = Number(ops.avg_daily);
    if (!Number.isFinite(recommended) || recommended <= 0 || !Number.isFinite(avgDaily) || avgDaily <= 0) {
        return { available: false };
    }

    const ratio = recommended / avgDaily;
    let label = 'ok';
    if (ratio >= 1.25) label = 'critical';
    else if (ratio >= 1.1) label = 'pressure';

    return {
        available: true,
        forecast_value: Math.round(recommended),
        avg_daily: Math.round(avgDaily * 100) / 100,
        ratio: round(ratio, 3),
        label,
    };
}

function enrichOperationsDerived(data) {
    if (!data || typeof data !== 'object') return data;

    const ops = data.operations || {};
    const callMetrics = ops.call_metrics || {};
    const contactDist = ops.contact_distribution || {};

    const totalRecords = Number(callMetrics.total_records) || 0;
    const uniqueContacts = Number(callMetrics.unique_contacts) || 0;
    const firstAttempts = Number(contactDist.first_attempts) || 0;
    const attempts1to3 = Number(contactDist.attempts_1_to_3) || 0;
    const overcontactPct = Number(contactDist.overcontact_pct) || 0;
    const totalLeads = Number(ops.total_leads) || 0;

    data.operations = ops;
    ops.derived = {
        first_contact_rate: round(safeDiv(firstAttempts, uniqueContacts)),
        dial_efficiency: round(safeDiv(uniqueContacts, totalRecords)),
        sweet_spot_pct: round(safeDiv(attempts1to3, totalRecords) != null
            ? safeDiv(attempts1to3, totalRecords) * 100
            : null, 2),
        overcontact_index: round(totalRecords > 0 ? (overcontactPct * totalRecords) / 100 : null, 0),
        leads_per_record: round(safeDiv(totalLeads, totalRecords)),
        forecast_vs_capacity: buildForecastVsCapacity(data),
    };

    const econCfg = resolveEconomicsConfig(data);
    const conversionPct = Number(data.funnel?.conversion_pct ?? data.funnel?.global_conversion_pct);
    const conversions = countConversions(data, econCfg.conversion_target);
    const totalSpend = Number(data.investment?.total_spend) || 0;
    const globalCpl = Number(data.investment?.cpl?.global_cpl);

    const revenueEstimated = conversions * econCfg.revenue_per_conversion;
    const breakevenCpl = Number.isFinite(conversionPct) && conversionPct > 0
        ? econCfg.revenue_per_conversion * (conversionPct / 100)
        : null;

    data.derived = data.derived || {};
    data.derived.economics = {
        revenue_per_conversion: econCfg.revenue_per_conversion,
        conversions_estimated: conversions,
        revenue_estimated: Math.round(revenueEstimated),
        roas_proxy: totalSpend > 0 ? round(revenueEstimated / totalSpend, 4) : null,
        breakeven_cpl: breakevenCpl != null ? round(breakevenCpl, 2) : null,
        breakeven_cpl_gap: breakevenCpl != null && Number.isFinite(globalCpl)
            ? round(globalCpl - breakevenCpl, 2)
            : null,
        conversion_pct_used: Number.isFinite(conversionPct) ? conversionPct : null,
    };

    data.meta = data.meta || {};
    data.meta._enriched_operations = true;

    return data;
}

module.exports = {
    enrichOperationsDerived,
    buildForecastVsCapacity,
};
